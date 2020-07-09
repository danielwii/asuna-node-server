// eslint-disable-next-line eslint-comments/disable-enable-pair
/* eslint-disable global-require,@typescript-eslint/no-var-requires */
import { ClassSerializerInterceptor, ValidationPipe } from '@nestjs/common';
import { NestFactory, Reflector } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import * as bodyParser from 'body-parser';
import * as compression from 'compression';
import * as rateLimit from 'express-rate-limit';
import * as helmet from 'helmet';
import * as _ from 'lodash';
import * as morgan from 'morgan';
import { dirname, resolve } from 'path';
import * as responseTime from 'response-time';
import { Connection, getConnectionOptions } from 'typeorm';
// import * as rookout from 'rookout';
import * as requestIp from 'request-ip';

import { AppLifecycle } from './lifecycle';
import { renameTables, runCustomMigrations } from './migrations';
import { CacheUtils } from './modules/cache/utils';
import { AnyExceptionFilter, LoggerInterceptor, r } from './modules/common';
import { LoggerFactory, LoggerHelper } from './modules/common/logger';
import { LoggerConfigObject } from './modules/common/logger/config';
import { ConfigKeys, configLoader } from './modules/config';
import { AccessControlHelper, AsunaContext, IAsunaContextOpts } from './modules/core';
import { Global } from './modules/core/global';
import { TracingInterceptor } from './modules/tracing';
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
const pkg = require('../package.json');

export interface BootstrapOptions {
  // server folder
  // root?: string;
  // package folder
  // dirname?: string;
  staticAssets?: string;
  viewsDir?: string;
  viewEngine?: string;
  typeormEntities?: string[];
  version?: string;
  /**
   * io     - socket.io
   * redis  - 基于 redis 共享 websocket 信息
   * ws     - websocket
   */
  redisMode?: 'io' | 'redis' | 'ws';
  context?: IAsunaContextOpts;
  renamer?: { from: string; to: string }[];
}

export async function bootstrap(appModule, options: BootstrapOptions = {}): Promise<NestExpressApplication> {
  require('events').EventEmitter.defaultMaxListeners = 15;

  await CacheUtils.clearAll();
  const logger = LoggerFactory.getLogger('bootstrap');
  logger.log(`options: ${r(options)}`);
  // logger.log(`configs: ${r(configLoader.loadConfigs())}`);

  const dbConfig = await getConnectionOptions();
  logger.log(
    `dbConfig: ${r(_.omit(dbConfig, 'password'))} withPassword: ******${_.get(dbConfig, 'password').slice(-4)}`,
  );

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

  logger.log('sync db ...');
  const queryRunner = connection.createQueryRunner();
  await Promise.all(
    _.map(_.compact(renameTables.concat(options.renamer)), async ({ from, to }) => {
      logger.log(`rename table ${r({ from, to })}`);
      const fromTable = await queryRunner.getTable(from);
      if (fromTable) {
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
  await runCustomMigrations();
  logger.log(`run custom migrations ... done`);

  if (Global.dbType !== 'sqlite') {
    await connection.query('SET FOREIGN_KEY_CHECKS=1');
  }
  logger.log(`sync db done. ${Date.now() - beforeSyncDB}ms`);

  logger.log(`pending migrations: ${await connection.showMigrations()}`);

  // may add bootstrap lifecycle for static initialize
  AccessControlHelper.init();

  // --------------------------------------------------------------
  // setup application
  // --------------------------------------------------------------

  app.use(requestIp.mw());
  app.use(helmet());
  app.use(compression());
  app.use(responseTime());
  if (configLoader.loadNumericConfig(ConfigKeys.RATE_LIMIT_ENABLED))
    app.use(
      rateLimit({
        windowMs: 60 * 1e3, // 1 minute(s)
        max: configLoader.loadNumericConfig(ConfigKeys.RATE_LIMIT, 100), // limit each IP to 1000 requests per windowMs
        message: 'Too many requests from this IP, please try again after 1474560 minutes.',
      }),
    );
  app.use(morgan('combined'));

  const limit = configLoader.loadConfig(ConfigKeys.PAYLOAD_LIMIT, '20mb');
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
  // app.enableCors(); fixme temp disable for allow OPTIONS
  app.enableShutdownHooks();

  if (AsunaContext.isDebugMode) {
    logger.warn('[X] debug mode is enabled, but no features for debug mode exists :P');
  }

  // --------------------------------------------------------------
  // Setup Swagger
  // --------------------------------------------------------------

  if (configLoader.loadBoolConfig(ConfigKeys.SWAGGER)) {
    logger.log('[X] init swagger at /swagger');
    const swaggerOptions = new DocumentBuilder()
      .setTitle('API Server')
      .setVersion(`${options.version}, Core: ${pkg.version}`)
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
  const rootDir = dirname(process.mainModule.filename);
  logger.log(`main entrance is ${r(process.mainModule.filename)}`);
  const { packageDir } = global;
  const suffix = packageDir.includes('node_modules') ? 'js' : 'ts';
  const entities = [
    `${resolve(packageDir)}/**/*entities.${suffix}`,
    `${resolve(rootDir)}/**/*entities.ts`,
    ...(options.typeormEntities || []),
  ];
  const subscribers = [`${resolve(packageDir)}/**/*subscriber.${suffix}`, `${resolve(rootDir)}/**/*subscriber.ts`];
  logger.log(`options is ${r({ options, packageDir, rootDir, suffix, entities, subscribers })}`);

  logger.log(`resolve typeorm entities: ${r(entities)}`);
  logger.log(`resolve typeorm subscribers: ${r(subscribers)}`);

  process.env.TYPEORM_ENTITIES = entities.join();
  process.env.TYPEORM_SUBSCRIBERS = subscribers.join();
}
