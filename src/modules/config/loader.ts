import { AppEnv } from '@danielwii/asuna-helper/dist/app.env';
import { LoggerFactory } from '@danielwii/asuna-helper/dist/logger';

import { ConfigLoader, createConfigLoader } from 'node-buffs';
import { resolve } from 'path';

const logger = LoggerFactory.getLogger('ConfigLoader');

export const configLoader: ConfigLoader = createConfigLoader({
  requiredVariables: [],
  basePath: resolve(__dirname, '../../..'),
});
AppEnv.regConfigLoader(configLoader);

logger.log(`NODE_ENV: ${process.env.NODE_ENV}`);
logger.log(`ENV: ${process.env.ENV}`);
// logger.log(`configs: ${r(configLoader.loadConfigs())}`);
