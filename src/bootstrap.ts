import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import * as helmet from 'helmet';
import * as morgan from 'morgan';
import * as compression from 'compression';
import * as responseTime from 'response-time';
import * as rateLimit from 'express-rate-limit';
import { json } from 'body-parser';
import { resolve } from 'path';
import { AnyExceptionFilter } from './modules/common/filters/any-exception.filter';
import { ConfigKeys, configLoader } from './modules/helpers';
import { AsunaContext, IAsunaContextOpts } from './modules/core';

const logger = new Logger('bootstrap');
const startAt = Date.now();

if (process.env.NODE_ENV === 'production') {
  logger.log(`[X] run as production mode at ${__dirname}`);
  const moduleAlias = require('module-alias');
  moduleAlias.addPath(__dirname);
} else {
  logger.log(`[X] run as non-production mode at ${__dirname}`);
}

const pkg = require('../package.json');

interface IBootstrapOptions {
  root?: string;
  version?: string;
  redisMode?: 'io' | 'redis' | 'ws';
  context?: IAsunaContextOpts;
}

export async function bootstrap(appModule, options: IBootstrapOptions = {}): Promise<any> {
  logger.log(`options: ${JSON.stringify(options)}`);

  AsunaContext.instance.init(options.context || { root: options.root });

  // --------------------------------------------------------------
  // Setup app
  // --------------------------------------------------------------

  // 根据环境变量调整要拉取的实体
  let isProduction = process.env.NODE_ENV === 'production';
  let isBuild = __filename.endsWith('js');
  let suffix = isProduction ? 'js' : 'ts'; // used to detect files for caller
  const entities =
    isProduction || isBuild
      ? [
          `${resolve(__dirname)}/**/*.entities.js`,
          `${resolve(__dirname, '../')}/**/*.entities.js`,
          `${resolve(options.root)}/**/*.entities.${suffix}`,
        ]
      : [
          `${resolve(__dirname)}/**/*.entities.ts`,
          `${resolve(__dirname, '../../packages')}/**/*.entities.ts`,
          `${resolve(options.root)}/**/*.entities.${suffix}`,
        ];
  const subscribers =
    isProduction || isBuild
      ? [
          `${resolve(__dirname)}/**/*.subscriber.js`,
          `${resolve(__dirname, '../')}/**/*.subscriber.js`,
          `${resolve(options.root)}/**/*.subscriber.${suffix}`,
        ]
      : [
          `${resolve(__dirname)}/**/*.subscriber.ts`,
          `${resolve(__dirname, '../../packages')}/**/*.subscriber.ts`,
          `${resolve(options.root)}/**/*.subscriber.${suffix}`,
        ];

  logger.log(`resolve typeorm entities: ${entities}`);
  logger.log(`resolve typeorm subscribers: ${subscribers}`);

  process.env.TYPEORM_ENTITIES = entities.join();
  process.env.TYPEORM_SUBSCRIBERS = subscribers.join();

  const app = await NestFactory.create<NestExpressApplication>(appModule);
  app.useGlobalFilters(new AnyExceptionFilter());
  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));

  if (options.redisMode === 'redis') {
    app.useWebSocketAdapter(new (require('./modules/ws/redis.adapter')).RedisIoAdapter(app));
  } else if (options.redisMode === 'ws') {
    app.useWebSocketAdapter(new (require('@nestjs/platform-ws')).WsAdapter(app));
  }

  app.use(helmet());
  app.use(compression());
  app.use(responseTime());
  app.use(
    rateLimit({
      windowMs: 60 * 1e3, // 1 minute(s)
      max: 1000, // limit each IP to 1000 requests per windowMs
    }),
  );
  app.use(morgan('dev'));
  app.use(json({ limit: configLoader.loadConfig(ConfigKeys.PAYLOAD_LIMIT, '1mb') }));
  app.enableShutdownHooks();

  if (AsunaContext.isDebugMode) {
    logger.log(`[X] debug mode is enabled`);

    // --------------------------------------------------------------
    // Setup Swagger
    // --------------------------------------------------------------

    logger.log(`[X] init swagger at /swagger`);
    const swaggerOptions = new DocumentBuilder()
      .setTitle('API Server')
      .setVersion(options.version)
      .build();
    const document = SwaggerModule.createDocument(app, swaggerOptions);
    SwaggerModule.setup('/swagger', app, document);
  }

  const port = configLoader.loadConfig(ConfigKeys.PORT, 5000);

  return app.listen(port).then(opts => {
    logger.log(`started in ${Date.now() - startAt}ms, listening on ${port}`);

    // --------------------------------------------------------------
    // preload data
    // --------------------------------------------------------------

    // dataLoaderProxy()
    //   .preload()
    //   .catch(console.error);

    return app;
  });
}
