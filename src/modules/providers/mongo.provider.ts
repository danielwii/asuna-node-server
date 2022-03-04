import { MongooseModule, MongooseModuleOptions } from '@nestjs/mongoose';

import { LoggerFactory } from '@danielwii/asuna-helper/dist/logger/factory';
import { r } from '@danielwii/asuna-helper/dist/serializer';

import { MongoConfigObject } from './mongo.config';

import type { DynamicModule } from '@nestjs/common';

const logger = LoggerFactory.getLogger('MongoProvider');

export class MongoProvider {
  public static forRootAsync = (): DynamicModule =>
    MongooseModule.forRootAsync({
      useFactory: () => {
        const configObject = MongoConfigObject.load();
        if (!configObject.enable) {
          throw new Error('mongo not enabled');
        }
        const options: MongooseModuleOptions = {
          uri: configObject.srv ? `mongodb+srv://${configObject.host}` : `mongodb://${configObject.host}`,
          user: configObject.username,
          pass: configObject.password,
          dbName: configObject.db,
          authSource: 'admin',
          connectionFactory: (connection, name) => {
            logger.log(`connect to ${name}...`);
            // eslint-disable-next-line
            connection.plugin(require('mongoose-autopopulate'));
            return connection;
          },
        };
        logger.log(`init by ${r(options)}`);
        return options;
      },
    });
}
