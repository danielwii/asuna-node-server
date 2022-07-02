import { Logger } from '@nestjs/common';

import { AppEnv } from '@danielwii/asuna-helper/dist/app.env';

import { ConfigLoader, createConfigLoader } from 'node-buffs';
import { resolve } from 'path';

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

Logger.log(`NODE_ENV: ${process.env.NODE_ENV}`);
Logger.log(`ENV: ${process.env.ENV}`);
// logger.log(`configs: ${r(configLoader.loadConfigs())}`);
