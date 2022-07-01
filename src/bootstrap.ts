import opentelemetry from '@opentelemetry/api';
import { JaegerExporter } from '@opentelemetry/exporter-jaeger';
import { registerInstrumentations } from '@opentelemetry/instrumentation';
import { ExpressInstrumentation } from '@opentelemetry/instrumentation-express';
import { GraphQLInstrumentation } from '@opentelemetry/instrumentation-graphql';
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';
import { Resource } from '@opentelemetry/resources';
import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';
import { BatchSpanProcessor, ConsoleSpanExporter, SimpleSpanProcessor } from '@opentelemetry/tracing';
import * as Sentry from '@sentry/node';

import { ClassSerializerInterceptor, Logger, NestApplicationOptions, ValidationPipe } from '@nestjs/common';
import { NestFactory, Reflector } from '@nestjs/core';
import { registerEnumType } from '@nestjs/graphql';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

import { ConfigKeys } from '@danielwii/asuna-helper/dist/config';
import { resolveModule } from '@danielwii/asuna-helper/dist/logger/factory';
import { RedisProvider } from '@danielwii/asuna-helper/dist/providers/redis/provider';
import { getClientIp } from '@danielwii/asuna-helper/dist/req';
import { r } from '@danielwii/asuna-helper/dist/serializer';
import { parseJSONIfCould } from '@danielwii/asuna-helper/dist/utils';

import compression from 'compression';
import RedisStoreCreator from 'connect-redis';
import consola from 'consola';
import cookieParser from 'cookie-parser';
import express from 'express';
import { default as rateLimit, Options as RateLimitOptions } from 'express-rate-limit';
import session from 'express-session';
import helmet from 'helmet';
import _ from 'lodash';
import morgan from 'morgan';
import responseTime from 'response-time';

import { resolveTypeormPaths, syncDbWithLockIfPossible, validateOptions } from './helper';
import { AppLifecycle } from './lifecycle';
import {
  AppUpgradeMode,
  ExchangeCurrencyEnum,
  KeyValueType,
  KVModelFormatType,
  MediaType,
  Mode,
  MongoConfigObject,
  NotificationEnum,
  NotificationEnumValue,
  Order,
  Platform,
} from './modules';
import { CacheUtils } from './modules/cache';
import { AnyExceptionFilter, LoggerConfigObject, LoggerInterceptor, TimeUnit } from './modules/common';
import { AppConfigObject, configLoader, FeaturesConfigObject } from './modules/config';
import {
  FeedbackSenderEnum,
  FeedbackSenderEnumValue,
  FeedbackStatusEnum,
  FeedbackStatusEnumValue,
} from './modules/content/enum-values';
import { AsunaContext, Global } from './modules/core';
import { UserRelationType } from './modules/core/interaction/friends.entities';
import { DefaultModule } from './modules/default.module';
import { SimpleIdGeneratorHelper } from './modules/ids';
import { TracingInterceptor } from './modules/tracing';
// add condition function in typeorm find operation
import './typeorm.fixture';

import type { CorsOptions, CorsOptionsDelegate } from '@nestjs/common/interfaces/external/cors-options.interface';
import type { LogLevel } from '@nestjs/common/services/logger.service';
import type { NestExpressApplication } from '@nestjs/platform-express';
import type { BootstrapOptions } from './interface';

export const bootstrap = (appModule, options: BootstrapOptions) => {
  const logger = new Logger(resolveModule(__filename, 'bootstrap'));
  process.on('unhandledRejection', (reason, p) => {
    logger.error(`Possibly Unhandled Rejection at: Promise ${r({ p, reason })}`);
    consola.error(r(reason));
    Sentry.captureException(reason);
  });
  process.on('uncaughtException', (reason, e) => {
    logger.error(`Uncaught Exception at: ${r({ e, reason })}`);
    consola.error(r(reason));
    Sentry.captureException(reason);
    process.exit(1);
  });
  process.on('beforeExit', (reason) => {
    logger[reason ? 'error' : 'log'](`App will exit cause: ${r(reason)}`);
  });
  process.on('exit', (reason) => {
    logger[reason ? 'error' : 'log'](`App exit cause: ${r(reason)}`);
  });

  /*
  const provider = new NodeTracerProvider(/!* {
    resource: new Resource({
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      [SemanticResourceAttributes.HOST_NAME]: require('os').hostname(),
      [SemanticResourceAttributes.SERVICE_NAME]: 'asuna-node-server',
    }),
  } *!/);

  // register and load instrumentation and old plugins - old plugins will be loaded automatically as previously
  // but instrumentations needs to be added
  registerInstrumentations({
    tracerProvider: provider,
    instrumentations: [
      new GraphQLInstrumentation(),
      new ExpressInstrumentation(),
      new HttpInstrumentation(/!* {
      requestHook: (span, request) => {
        span.setAttribute("custom request hook attribute", "request");
      },
    } *!/),
    ],
  });
  opentelemetry.trace.setGlobalTracerProvider(provider);

  const exporter = new JaegerExporter();
  provider.addSpanProcessor(new BatchSpanProcessor(exporter) as any);
  if (process.env.NODE_ENV !== 'production') {
    provider.addSpanProcessor(new SimpleSpanProcessor(new ConsoleSpanExporter()) as any);
  }
  provider.register(); */

  // https://docs.nestjs.com/graphql/unions-and-enums#unions
  registerEnumType(NotificationEnum, {
    name: 'NotificationEnum',
    description: JSON.stringify(NotificationEnumValue.data),
  });
  registerEnumType(FeedbackStatusEnum, {
    name: 'FeedbackStatusEnum',
    description: JSON.stringify(FeedbackStatusEnumValue.data),
  });
  registerEnumType(FeedbackSenderEnum, {
    name: 'FeedbackSenderEnum',
    description: JSON.stringify(FeedbackSenderEnumValue.data),
  });
  registerEnumType(MediaType, { name: 'MediaType' });
  registerEnumType(UserRelationType, { name: 'UserRelationType' });
  registerEnumType(Mode, { name: 'Mode' });
  registerEnumType(AppUpgradeMode, { name: 'AppUpgradeMode' });
  registerEnumType(Platform, { name: 'Platform' });
  registerEnumType(Order, { name: 'Order' });
  registerEnumType(KVModelFormatType, { name: 'KVModelFormatType' });
  registerEnumType(KeyValueType, { name: 'KeyValueType' });
  registerEnumType(ExchangeCurrencyEnum, { name: 'ExchangeCurrencyEnum' });

  if (configLoader.loadBoolConfig('DEBUG')) {
    logger.debug(`Configs is ${r(configLoader.loadConfigs())}`);
  }

  return run(appModule, options).catch((reason) => {
    logger.error(`[bootstrap] error: ${reason?.message} ${r(reason?.stack)}`);
    Sentry.captureException(reason);
    setTimeout(() => {
      consola.error(`[bootstrap] System will exit in 1s because of error: ${reason?.message} ${r(reason?.stack)}`);
      process.exit(1);
    }, TimeUnit.SECONDS.toMillis(1));
  });
};

export async function run(appModule, options: BootstrapOptions): Promise<NestExpressApplication> {
  const startAt = Date.now();
  Object.assign(options, _.merge({ loadDefaultModule: true }, options));
  validateOptions(options);

  // eslint-disable-next-line
  require('events').EventEmitter.defaultMaxListeners = 15;

  const logger = new Logger(resolveModule(__filename, 'run'));

  logger.log(`options: ${r({ appModule, options })}`);

  await AppLifecycle.preload();
  await CacheUtils.clearAll();
  // logger.log(`configs: ${r(configLoader.loadConfigs())}`);

  process.env.TYPEORM_MAX_QUERY_EXECUTION_TIME = process.env.TYPEORM_MAX_QUERY_EXECUTION_TIME || '2000';
  logger.log(`set slow query time ${process.env.TYPEORM_MAX_QUERY_EXECUTION_TIME}`);
  // const dbConfig = await getConnectionOptions();
  logger.log(`Global is ${r({ ...Global })}`);
  // logger.log(`dbConfig: ${r(_.omit(dbConfig, 'password'))} withPassword: *$****${_.get(dbConfig, 'password').slice(-4)}`);

  const mongoConfig = MongoConfigObject.load();
  logger.log(
    `mongoConfig: ${r(_.omit(mongoConfig, 'password'))} withPassword: *$****${_.get(mongoConfig, 'password')?.slice(
      -4,
    )}`,
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

  await resolveTypeormPaths(options);

  const logLevels: LogLevel[] = ['error', 'warn', 'log', 'debug', 'verbose'];
  if (['mysql56', 'mysql57', 'mysql8'].includes(Global.dbType)) {
    const extra = parseJSONIfCould(process.env.TYPEORM_DRIVER_EXTRA) ?? {};
    extra.charset = 'utf8mb4_unicode_ci';
    const TYPEORM_DRIVER_EXTRA = JSON.stringify(extra);
    logger.log(`🐛 fix typeorm utf8mb4 connection issue... set TYPEORM_DRIVER_EXTRA=${TYPEORM_DRIVER_EXTRA}`);
    process.env.TYPEORM_DRIVER_EXTRA = TYPEORM_DRIVER_EXTRA;
  }
  const appOptions: NestApplicationOptions = {
    logger: logLevels.slice(0, logLevels.indexOf(configLoader.loadConfig('LOGGER_LEVEL')) + 1) || ['error', 'warn'],
    bufferLogs: true,
  };
  const module = options.loadDefaultModule ? DefaultModule.forRoot(appModule) : appModule;
  logger.log(`create app ... ${r({ module, appOptions, options })}`);
  const app = await NestFactory.create<NestExpressApplication>(module, appOptions);

  logger.log(`sync db ...`);
  await syncDbWithLockIfPossible(app, options);
  await AppLifecycle.onInit(app);

  // await DBHelper.initPrismaClient();

  // --------------------------------------------------------------
  // setup application
  // --------------------------------------------------------------

  /*
  https://github.com/expressjs/cors#configuration-options
  https://github.com/expressjs/cors#configuring-cors-asynchronously
    不要盲目反射 Origin 头
    严格校验 Origin 头，避免出现权限泄露
    不要配置 Access-Control-Allow-Origin: null
    HTTPS 网站不要信任 HTTP 域
    不要信任全部自身子域，减少攻击面
    不要配置 Origin:* 和 Credentials: true，CORS 规定无法同时使用
    增加 Vary: Origin 头来区分不同来源的缓存
   */
  const corsOptions: CorsOptions | CorsOptionsDelegate<any> = {
    credentials: true,
    origin: true, // reflect from req.header('Origin') TODO dynamic from a function with whitelist
    // allowedHeaders: '*',
    // methods: '*',
  };
  logger.log(`setup cors ${r(corsOptions)}`);
  app.enableCors(corsOptions);

  // see https://expressjs.com/en/guide/behind-proxies.html
  // 设置以后，req.ips 是 ip 数组；如果未经过代理，则为 []. 若不设置，则 req.ips 恒为 []
  app.set('trust proxy', true);

  const secret = configLoader.loadConfig(ConfigKeys.SECRET_KEY, 'secret');
  // get client ip and populate to req
  app.use((req, res, next) => {
    const ip = getClientIp(req);
    Object.defineProperty(req, 'clientIp', { get: () => ip, configurable: true });
    next();
  });
  app.use(cookieParser(secret));
  // http://www.febeacon.com/helmet-docs-zh-CN/routes/install/#%E5%B7%A5%E4%BD%9C%E5%8E%9F%E7%90%86
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          'default-src': ["'self'"],
          'base-uri': ["'self'"],
          'block-all-mixed-content': [],
          'font-src': ["'self'", 'https:', 'data:'],
          'frame-ancestors': ["'self'"],
          // load all domains' images
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
        // IMPORTANT no-referrer is the default and payment will not work
        /*
        no-referrer	整个 Referer 报头会被移除。访问来源信息不随着请求一起发送。
        no-referrer-when-downgrade 默认值	在没有指定任何策略的情况下用户代理的默认行为。在同等安全级别的情况下，引用页面的地址会被发送(HTTPS->HTTPS)，但是在降级的情况下不会被发送 (HTTPS->HTTP)。
        origin	在任何情况下，仅发送文件的源作为引用地址。例如 https://example.com/page.html 会将 https://example.com/ 作为引用地址。
        origin-when-cross-origin	对于同源的请求，会发送完整的URL作为引用地址，但是对于非同源请求仅发送文件的源。
        same-origin	对于同源的请求会发送引用地址，但是对于非同源请求则不发送引用地址信息。
        strict-origin	在同等安全级别的情况下，发送文件的源作为引用地址(HTTPS->HTTPS)，但是在降级的情况下不会发送 (HTTPS->HTTP)。
        strict-origin-when-cross-origin	于同源的请求，会发送完整的URL作为引用地址；在同等安全级别的情况下，发送文件的源作为引用地址(HTTPS->HTTPS)；在降级的情况下不发送此报头 (HTTPS->HTTP)。
        unsafe-url	无论是同源请求还是非同源请求，都发送完整的 URL（移除参数信息之后）作为引用地址。
         */
        policy: 'unsafe-url',
      },
    }),
  );
  app.use(compression());

  const sessionRedisDB = configLoader.loadNumericConfig('SESSION_REDIS_DB', 2);
  const sessionRedis = RedisProvider.getRedisClient('session', sessionRedisDB, true);
  logger.log(`session redis enabled: ${sessionRedis.isEnabled}`);
  app.use(
    session({
      // name 返回客户端的key的名称，默认为asn.seid,也可以自己设置。
      name: 'asn.seid',
      store: sessionRedis.isEnabled
        ? new (RedisStoreCreator(session))({ client: sessionRedis.client })
        : new session.MemoryStore(),
      // 一个String类型的字符串，作为服务器端生成session的签名。
      secret,
      // (是否允许)当客户端并行发送多个请求时，其中一个请求在另一个请求结束时对session进行修改覆盖并保存。
      // 默认为true。但是(后续版本)有可能默认失效，所以最好手动添加。
      resave: true,
      // 设置返回到前端key的属性，默认值为{ path: ‘/', httpOnly: true, secure: false, maxAge: null } 。
      /*
        secure - 确保浏览器只通过 HTTPS 发送 cookie。
        httpOnly - 确保 cookie 只通过 HTTP(S)（而不是客户机 JavaScript）发送，这有助于防御跨站点脚本编制攻击。
        domain - 表示 cookie 的域；用于和请求 URL 的服务器的域进行比较。如果匹配，那么接下来检查路径属性。
        path - 表示 cookie 的路径；用于和请求路径进行比较。如果路径和域都匹配，那么在请求中发送 cookie。
        expires - 用于为持久性 cookie 设置到期日期。
       */
      cookie: { path: '/', httpOnly: true, secure: true, /* domain: '*', */ maxAge: null, sameSite: 'none' },
      // 初始化session时是否保存到存储。默认为true， 但是(后续版本)有可能默认失效，所以最好手动添加。
      saveUninitialized: true,
      genid: () => SimpleIdGeneratorHelper.randomId('se'),
    }),
  );

  app.use(responseTime());
  if (configLoader.loadBoolConfig(ConfigKeys.RATE_LIMIT_ENABLED)) {
    const rateOptions: Partial<RateLimitOptions> = {
      windowMs: 60 * 1e3, // 1 minute(s)
      max: configLoader.loadNumericConfig(ConfigKeys.RATE_LIMIT, 100), // limit each IP to 1000 requests per windowMs
      message: 'Too many requests from this IP, please try again after 1474560 minutes.',
    };
    logger.log(`init rate limit with ${r(rateOptions)}`);
    app.use(rateLimit(rateOptions));
  }
  app.use(morgan('combined'));

  const limit = appSettings.payloadLimit;
  logger.log(`set json payload limit to ${limit}`);
  app.use(express.json({ limit }));
  app.use(express.urlencoded({ limit, extended: true }));

  app.useGlobalInterceptors(new TracingInterceptor());
  // WARNING will break graphql pubsub
  app.useGlobalInterceptors(new ClassSerializerInterceptor(app.get(Reflector)));
  app.useGlobalInterceptors(new LoggerInterceptor());
  app.useGlobalFilters(new AnyExceptionFilter());
  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));

  if (options.redisMode === 'redis') {
    app.useWebSocketAdapter(new (await import('./modules/ws/redis.adapter')).RedisIoAdapter(app));
  } else if (options.redisMode === 'ws') {
    app.useWebSocketAdapter(new (await import('@nestjs/platform-ws')).WsAdapter(app));
  }

  if (options.staticAssets) {
    logger.log(`set static assets path to ${options.staticAssets}`);
    app.useStaticAssets(options.staticAssets, { maxAge: TimeUnit.MINUTES.toMillis(10) });
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
  return app.listen(port).then(async () => {
    await AppLifecycle.onAppStartListening(app);
    logger.log(`===============================================================`);
    logger.log(`🚀 started in ${Date.now() - startAt}ms, listening on ${port}. ${await app.getUrl()}`);
    logger.log(`===============================================================`);
    return app;
  });
}
