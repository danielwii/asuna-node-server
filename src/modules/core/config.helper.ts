import { Logger } from '@nestjs/common';
import { ConfigLoader, createConfigLoader } from 'node-buffs';

const logger = new Logger('ConfigLoader');

export const ConfigKeys = {
  ADMIN_SECRET_KEY: 'ADMIN_SECRET_KEY',
  SECRET_KEY: 'SECRET_KEY',
  DEBUG: 'DEBUG',
  SWAGGER: 'SWAGGER',
  PORT: 'PORT',
  TRACING: 'TRACING',
  DB_TYPE: 'DB_TYPE',

  /**
   * 用与访问上传文件的资源地址
   */
  RESOURCE_PATH: 'RESOURCE_PATH',

  VIDEO_STORAGE: 'VIDEO_STORAGE',
  IMAGE_STORAGE: 'IMAGE_STORAGE',
  FILE_STORAGE: 'FILE_STORAGE',

  MAIL_HOST: 'MAIL_HOST',
  MAIL_PORT: 'MAIL_PORT',
  MAIL_SSL: 'MAIL_SSL',
  MAIL_USERNAME: 'MAIL_USERNAME',
  MAIL_PASSWORD: 'MAIL_PASSWORD',
  MAIL_FROM: 'MAIL_FROM',

  // WS_REDIS_HOST: 'WS_REDIS_HOST',
  // WS_REDIS_PORT: 'WS_REDIS_PORT',
  // WS_REDIS_PASSWORD: 'WS_REDIS_PASSWORD',
  WS_REDIS_ENABLE: 'WS_REDIS_ENABLE',
  WS_REDIS_DB: 'WS_REDIS_DB',

  JOB_REDIS_ENABLE: 'JOB_REDIS_ENABLE',
  JOB_REDIS_DB: 'JOB_REDIS_DB',

  // ACTION_CACHE_HOST: 'ACTION_CACHE_HOST',
  // ACTION_CACHE_PORT: 'ACTION_CACHE_PORT',
  // ACTION_CACHE_PASSWORD: 'ACTION_CACHE_PASSWORD',
  // ACTION_CACHE_DB: 'ACTION_CACHE_DB',
  // ACTION_CACHE_DURATION: 'ACTION_CACHE_DURATION',
  PAYLOAD_LIMIT: 'PAYLOAD_LIMIT',

  OTP_SECRET: 'OTP_SECRET',
};

export const configLoader: ConfigLoader = createConfigLoader({
  requiredVariables: [],
});

// logger.log(`NODE_ENV: ${util.inspect(configLoader.loadConfigs())}`);
logger.log(`NODE_ENV: ${process.env.NODE_ENV}`);
logger.log(`ENV: ${process.env.ENV}`);
