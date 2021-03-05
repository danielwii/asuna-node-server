import { DynamicModule } from '@nestjs/common';
import { MongooseModule, MongooseModuleOptions } from '@nestjs/mongoose';
import { r } from '../common/helpers';
import { LoggerFactory } from '../common/logger';
import { MongoConfigObject } from './mongo.config';

const logger = LoggerFactory.getLogger('MongoProvider');

export class MongoProvider {
  static forRootAsync(): DynamicModule {
    return MongooseModule.forRootAsync({
      useFactory: () => {
        const configObject = MongoConfigObject.load();
        const uri = `mongodb://${configObject.host}:${configObject.port}/${configObject.db}`;
        if (!configObject.enable) {
          throw new Error('mongo not enabled');
        }
        const options: MongooseModuleOptions = {
          uri,
          connectionFactory: (connection) => {
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
}
