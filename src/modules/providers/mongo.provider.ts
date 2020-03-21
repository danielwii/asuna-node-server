import { DynamicModule } from '@nestjs/common';
import { MongooseModule, MongooseModuleOptions } from '@nestjs/mongoose';
import { r } from '../common/helpers';
import { LoggerFactory } from '../common/logger';
import { MongoConfigObject } from './mongo.config';

const logger = LoggerFactory.getLogger('MongoProvider');

export class MongoProvider {
  static module(): DynamicModule {
    return MongooseModule.forRootAsync({
      useFactory: () => {
        const configObject = MongoConfigObject.load();
        const uri = `mongodb://${configObject.host}:${configObject.port}/${configObject.db}`;
        if (!configObject.enable) {
          throw new Error('mongo not enabled');
        }
        const options = {
          uri,
          connectionFactory: connection => {
            // eslint-disable-next-line global-require,@typescript-eslint/no-var-requires
            connection.plugin(require('mongoose-autopopulate'));
            return connection;
          },
        } as MongooseModuleOptions;
        logger.log(`init by ${r(options)}`);
        return options;
      },
    });
  }
}
