import { AppEnv } from '@danielwii/asuna-helper/dist/app.env';
import { LoggerFactory } from '@danielwii/asuna-helper/dist/logger/factory';

import { ConfigLoader, createConfigLoader } from 'node-buffs';
import { resolve } from 'path';

const logger = LoggerFactory.getLogger('ConfigLoader');

export const configLoader: ConfigLoader = createConfigLoader({
  requiredVariables: [
    'TYPEORM_TYPE',
    'TYPEORM_HOST',
    'TYPEORM_PORT',
    'TYPEORM_DATABASE',
    'TYPEORM_USERNAME',
    'TYPEORM_PASSWORD',
  ],
  basePath: resolve(__dirname, '../../..'),
});
AppEnv.regConfigLoader(configLoader);

logger.log(`NODE_ENV: ${process.env.NODE_ENV}`);
logger.log(`ENV: ${process.env.ENV}`);
// logger.log(`configs: ${r(configLoader.loadConfigs())}`);
