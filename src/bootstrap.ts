/* eslint-disable @typescript-eslint/no-require-imports */
import { ClassSerializerInterceptor, ValidationPipe } from '@nestjs/common';
import { NestFactory, Reflector } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import * as bodyParser from 'body-parser';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import * as _ from 'lodash';
import morgan from 'morgan';
import { dirname, extname, resolve } from 'path';
import cookieParser from 'cookie-parser';
import session from 'express-session';
import RedisStoreCreator from 'connect-redis';
import * as requestIp from 'request-ip';
import responseTime from 'response-time';
import { Connection, getConnectionOptions } from 'typeorm';

import { AppLifecycle } from './lifecycle';
import { renameTables, runCustomMigrations } from './migrations';
import { CacheUtils } from './modules/cache';
import {
  AnyExceptionFilter,
  LoggerConfigObject,
  LoggerFactory,
  LoggerHelper,
  LoggerInterceptor,
  r,
} from './modules/common';
import { AppConfigObject, ConfigKeys, configLoader, FeaturesConfigObject } from './modules/config';
import { AccessControlHelper, AsunaContext, DBHelper, Global, IAsunaContextOpts } from './modules/core';
import { TracingInterceptor } from './modules/tracing';
import { SimpleIdGeneratorHelper } from './modules/ids';
import { RedisProvider } from './modules/providers';
// add condition function in typeorm find
import './typeorm.fixture';

/*
if (process.env.NODE_ENV === 'production') {
  logger.log(`[X] run as production mode at ${__dirname}`);
  const moduleAlias = require('module-alias');
  moduleAlias.addPath(__dirname as any);
} else {
  logger.log(`[X] run as non-production mode at ${__dirname}`);
}
*/
const startAt = Date.now();

export interface BootstrapOptions {
  // server folder
  // root?: string;
  // package folder
  // dirname?: string;
  staticAssets?: string;
  viewsDir?: string;
  viewEngine?: string;
  typeormEntities?: string[];
  /**
   * io     - socket.io
   * redis  - 基于 redis 共享 websocket 信息
   * ws     - websocket
   */
  redisMode?: 'io' | 'redis' | 'ws';
  context?: IAsunaContextOpts;
  renamer?: { from: string; to: string }[];
  migrations?: any[];
}

export async function bootstrap(appModule, options: BootstrapOptions = {}): Promise<NestExpressApplication> {
  require('events').EventEmitter.defaultMaxListeners = 15;

  await CacheUtils.clearAll();
  const logger = LoggerFactory.getLogger('bootstrap');
  logger.log(`options: ${r(options)}`);
  // logger.log(`configs: ${r(configLoader.loadConfigs())}`);

  process.env.TYPEORM_MAX_QUERY_EXECUTION_TIME = '1000';
  const dbConfig = await getConnectionOptions();
  logger.log(
    `dbConfig: ${r(_.omit(dbConfig, 'password'))} withPassword: ******${_.get(dbConfig, 'password').slice(-4)}`,
  );

  const appSettings = AppConfigObject.load();
  const features = FeaturesConfigObject.load();
  logger.log(`load app settings ${r(appSettings)}`);
  logger.log(`load features ${r(features)}`);
  logger.log(
    `init logger: ${r({
      config: LoggerConfigObject.load(),
      envs: _.pickBy(configLoader.loadConfigs(), (v, k) => k.startsWith('LOGGER_')),
    })}`,
  );

  // if (configLoader.loadConfig(ConfigKeys.ROOKOUT_TOKEN)) {
  //   rookout.start({ token: configLoader.loadConfig(ConfigKeys.ROOKOUT_TOKEN) }).catch((reason) => logger.error(reason));
  // }

  AsunaContext.instance.setup(options.context);
  // AsunaContext.instance.setup(options.context || { root: options.root });

  // --------------------------------------------------------------
  // Setup app
  // --------------------------------------------------------------

  resolveTypeormPaths(options);

  logger.log('create app ...');

  const { dbType } = Global;
  if (['mysql56', 'mysql57'].includes(dbType)) {
    logger.log('🐛 fix typeorm utf8mb4 connection issue... set TYPEORM_DRIVER_EXTRA={"charset": "utf8mb4_unicode_ci"}');
    process.env.TYPEORM_DRIVER_EXTRA = '{"charset": "utf8mb4_unicode_ci"}';
  }

  const app = await NestFactory.create<NestExpressApplication>(appModule, { logger: LoggerHelper.getLoggerService() });
  await AppLifecycle.onInit(app);

  // --------------------------------------------------------------
  // rename old tables to newer
  // --------------------------------------------------------------

  const beforeSyncDB = Date.now();
  const connection = app.get<Connection>(Connection);
  logger.log(`db connected: ${r({ isConnected: connection.isConnected, name: connection.name })}`);

  logger.log('sync db ...');
  const queryRunner = connection.createQueryRunner();
  await Promise.all(
    _.map(_.compact(renameTables.concat(options.renamer)), async ({ from, to }) => {
      logger.log(`rename table ${r({ from, to })}`);
      const fromTable = await queryRunner.getTable(from);
      const toTable = await queryRunner.getTable(to);
      if (toTable) {
        logger.warn(`Table ${to} already exists.`);
      } else if (fromTable) {
        logger.log(`rename ${from} -> ${to}`);
        await queryRunner.renameTable(fromTable, to);
      }
    }),
  );

  if (Global.dbType !== 'sqlite') {
    await connection.query('SET FOREIGN_KEY_CHECKS=0');
  }

  logger.log(`synchronize ...`);
  await connection.synchronize();
  logger.log(`synchronize ... done`);

  logger.log(`run custom migrations ...`);
  await runCustomMigrations(options.migrations);
  logger.log(`run custom migrations ... done`);

  if (Global.dbType !== 'sqlite') {
    await connection.query('SET FOREIGN_KEY_CHECKS=1');
  }
  logger.log(`sync db done. ${Date.now() - beforeSyncDB}ms`);

  logger.log(`pending migrations: ${await connection.showMigrations()}`);

  // may add bootstrap lifecycle for static initialize
  AccessControlHelper.init();
  await DBHelper.initPrismaClient();

  // --------------------------------------------------------------
  // setup application
  // --------------------------------------------------------------

  app.enableCors({ credentials: true, origin: true });

  // see https://expressjs.com/en/guide/behind-proxies.html
  // 设置以后，req.ips是ip数组；如果未经过代理，则为[]. 若不设置，则req.ips恒为[]
  app.set('trust proxy', true);

  const secret = configLoader.loadConfig(ConfigKeys.SECRET_KEY, 'secret');
  app.use(requestIp.mw());
  app.use(cookieParser(secret));
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          'default-src': ["'self'"],
          'base-uri': ["'self'"],
          'block-all-mixed-content': [],
          'font-src': ["'self'", 'https:', 'data:'],
          'frame-ancestors': ["'self'"],
          // TODO load all domains' images
          'img-src': ["'self'", 'data:', '*'],
          'object-src': ["'none'"],
          // TODO maybe more safer, 'unsafe-inline' used to run alipay script
          'script-src': ["'self'", "'unsafe-inline'", '*'],
          'script-src-attr': ["'none'"],
          'style-src': ["'self'", 'https:', "'unsafe-inline'"],
          'upgrade-insecure-requests': [],
        },
      },
      referrerPolicy: {
        // no-referrer is the default and payment will not work
        policy: 'no-referrer-when-downgrade',
      },
    }),
  );
  app.use(compression());

  const sessionRedis = RedisProvider.instance.getRedisClient('session');
  logger.log(`session redis enabled: ${sessionRedis.isEnabled}`);
  app.use(
    session({
      store: sessionRedis.isEnabled
        ? (new (RedisStoreCreator(session as any))({ client: sessionRedis.client }) as any)
        : new session.MemoryStore(),
      secret,
      resave: false,
      // cookie: { secure: true },
      saveUninitialized: true,
      genid: () => SimpleIdGeneratorHelper.randomId('se'),
    }),
  );

  app.use(responseTime());
  if (configLoader.loadBoolConfig(ConfigKeys.RATE_LIMIT_ENABLED))
    app.use(
      rateLimit({
        windowMs: 60 * 1e3, // 1 minute(s)
        max: configLoader.loadNumericConfig(ConfigKeys.RATE_LIMIT, 100), // limit each IP to 1000 requests per windowMs
        message: 'Too many requests from this IP, please try again after 1474560 minutes.',
      }),
    );
  app.use(morgan('combined'));

  const limit = appSettings.payloadLimit;
  logger.log(`set json payload limit to ${limit}`);
  app.use(bodyParser.json({ limit }));
  app.use(bodyParser.urlencoded({ limit, extended: true }));

  app.useGlobalInterceptors(new TracingInterceptor());
  app.useGlobalInterceptors(new ClassSerializerInterceptor(app.get(Reflector)));
  app.useGlobalInterceptors(new LoggerInterceptor());
  app.useGlobalFilters(new AnyExceptionFilter());
  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));

  if (options.redisMode === 'redis') {
    app.useWebSocketAdapter(new (require('./modules/ws/redis.adapter').RedisIoAdapter)(app));
  } else if (options.redisMode === 'ws') {
    app.useWebSocketAdapter(new (require('@nestjs/platform-ws').WsAdapter)(app));
  }

  if (options.staticAssets) {
    logger.log(`set static assets path to ${options.staticAssets}`);
    app.useStaticAssets(options.staticAssets);
  }

  if (options.viewsDir) {
    app.setBaseViewsDir(options.viewsDir);
    app.setViewEngine(options.viewEngine ?? 'hbs');
  }

  // app.use(csurf());
  app.enableShutdownHooks();

  if (AsunaContext.isDebugMode) {
    logger.warn('[X] debug mode is enabled, but no features for debug mode exists :P');
  }

  // --------------------------------------------------------------
  // Setup Swagger
  // --------------------------------------------------------------

  if (features.swaggerEnable) {
    logger.log('[X] init swagger at /swagger');
    const swaggerOptions = new DocumentBuilder()
      .setTitle('API Server')
      .setVersion(process.env.npm_package_version)
      .build();
    const document = SwaggerModule.createDocument(app, swaggerOptions);
    SwaggerModule.setup('/swagger', app, document);
  }

  const port = configLoader.loadNumericConfig(ConfigKeys.PORT, 5000);

  await AppLifecycle.beforeBootstrap(app);
  logger.log('bootstrap app ...');
  return app.listenAsync(port).then(async () => {
    logger.log(`===============================================================`);
    logger.log(`🚀 started in ${Date.now() - startAt}ms, listening on ${port}`);
    logger.log(`===============================================================`);
    await AppLifecycle.onAppStartListening(app);
    return app;
  });
}

/**
 * 根据环境变量调整要拉取的实体
 * @param options
 */
export function resolveTypeormPaths(options: BootstrapOptions = {}): void {
  const logger = LoggerFactory.getLogger('resolveTypeormPaths');
  // const wasBuilt = __filename.endsWith('js');
  const rootDir = dirname(require.main.filename);
  logger.log(`main entrance is ${r(require.main.filename)}`);
  const { packageDir } = global;
  const suffix = extname(__filename).slice(1);
  const currentSuffix = extname(require.main.filename).slice(1);
  // const convertPackage = suffix === 'js' ? _.replace(/dist/, 'src') : _.replace(/src/, 'dist');
  const entities = _.uniq([
    `${resolve(rootDir, '../..')}/packages/*/${suffix === 'js' ? 'dist' : 'src'}/**/*entities.${suffix}`,
    `${resolve(packageDir)}/**/*entities.${suffix}`,
    `${resolve(rootDir)}/**/*entities.${currentSuffix}`,
    ...(options.typeormEntities || []),
  ]);
  const subscribers = _.uniq([
    `${resolve(rootDir, '../..')}/packages/*/${suffix === 'js' ? 'dist' : 'src'}/**/*subscriber.${suffix}`,
    `${resolve(packageDir)}/**/*subscriber.${suffix}`,
    `${resolve(rootDir)}/**/*subscriber.${currentSuffix}`,
  ]);
  logger.log(`options is ${r({ options, packageDir, rootDir, suffix, entities, subscribers, __filename })}`);

  logger.log(`resolve typeorm entities: ${r(entities)}`);
  logger.log(`resolve typeorm subscribers: ${r(subscribers)}`);

  process.env.TYPEORM_ENTITIES = entities.join();
  process.env.TYPEORM_SUBSCRIBERS = subscribers.join();
}
