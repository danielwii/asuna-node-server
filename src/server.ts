import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import * as helmet from 'helmet';
import * as morgan from 'morgan';
import * as responseTime from 'response-time';
import { json } from 'body-parser';

const logger = new Logger('server');
const startAt = Date.now();

if (process.env.NODE_ENV === 'production') {
  logger.log(`[X] run as production mode at ${__dirname}`);
  const moduleAlias = require('module-alias');
  moduleAlias.addPath(__dirname);
}

import { AnyExceptionFilter } from './modules/common/filters/any-exception.filter';
import { ValidationPipe } from './modules/common/pipes/validation.pipe';
import { ConfigKeys, configLoader } from './modules/helpers/config.helper';
import { dataLoaderProxy } from './modules/dataloader';

interface IBootstrapOptions {}

export async function bootstrap(AppModule, options: IBootstrapOptions = {}): Promise<any> {
  // --------------------------------------------------------------
  // Setup app
  // --------------------------------------------------------------

  // 根据环境变量调整要拉取的实体
  if (process.env.NODE_ENV === 'production') {
    process.env.TYPEORM_ENTITIES = `${__dirname}/**/*.entities.js`;
  } else {
    process.env.TYPEORM_ENTITIES = `${__dirname}/**/*.entities.ts`;
  }

  const app = await NestFactory.create(AppModule);
  app.useGlobalFilters(new AnyExceptionFilter());
  app.useGlobalPipes(new ValidationPipe());
  app.use(helmet());
  app.use(responseTime());
  app.use(morgan('dev'));
  app.use(json({ limit: '10mb' }));

  if (configLoader.loadConfig(ConfigKeys.DEBUG)) {
    logger.log(`[X] debug mode is enabled`);

    // --------------------------------------------------------------
    // Setup Swagger
    // --------------------------------------------------------------

    // logger.log(`[X] init swagger at /swagger`);
    // const swaggerOptions = new DocumentBuilder()
    //   .setTitle('API Server')
    //   .setVersion(pkg.version)
    //   .build();
    // const document = SwaggerModule.createDocument(app, swaggerOptions);
    // SwaggerModule.setup('/swagger', app, document);
  }

  const port = configLoader.loadConfig(ConfigKeys.PORT, 5000);

  return app.listen(port).then(opts => {
    logger.log(`started in ${Date.now() - startAt}ms, listening on ${port}`);

    // --------------------------------------------------------------
    // preload data
    // --------------------------------------------------------------

    dataLoaderProxy()
      .preload()
      .catch(console.error);

    return app;
  });
}
