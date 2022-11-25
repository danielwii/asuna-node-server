import { Logger } from '@nestjs/common';

import { YamlConfigKeys } from '@danielwii/asuna-helper/dist/config';
import { resolveModule } from '@danielwii/asuna-helper/dist/logger/factory';
import { withP, withP2 } from '@danielwii/asuna-helper/dist/utils';

import { Expose, plainToInstance, Transform } from 'class-transformer';
import _ from 'lodash';

import { configLoader } from '../../config';
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);

export const QiniuConfigKeys = {
  QINIU_ENABLE: 'QINIU_ENABLE',
  QINIU_ACCESS_KEY: 'QINIU_ACCESS_KEY',
  QINIU_SECRET_KEY: 'QINIU_SECRET_KEY',
  QINIU_BUCKET_NAME: 'QINIU_BUCKET_NAME',
  QINIU_PATH: 'QINIU_PATH',
  QINIU_DOMAIN: 'QINIU_DOMAIN',
};

export class QiniuConfigObject {
  private static key = YamlConfigKeys.storage;
  private static prefix = `${QiniuConfigObject.key}_`;

  public enable: boolean;
  // bucket 应该用 scope 来替换，用来明确概念
  public bucket: string;
  /**
   * 用来和 /uploads/ 后面的路径做匹配
   */
  public path: string;
  public domain: string;
  public accessKey: string;

  @Expose({ name: 'with-secret-key', toPlainOnly: true })
  @Transform(({ value }) => !!value, { toPlainOnly: true })
  public secretKey: string;

  constructor(o: Partial<QiniuConfigObject>) {
    Object.assign(this, plainToInstance(QiniuConfigObject, o, { enableImplicitConversion: true }));
  }

  public static load(prefix: 'videos' | 'images' | 'files' | 'chunks' | string = ''): QiniuConfigObject {
    const appendPrefix = prefix ? `${prefix}_`.toUpperCase() : '';
    Logger.verbose(`try load env: ${QiniuConfigObject.prefix}${appendPrefix}${QiniuConfigKeys.QINIU_ENABLE}`);
    return withP2(
      (p): any => configLoader.loadConfig2(QiniuConfigObject.key, p),
      QiniuConfigKeys,
      (loader, keys) =>
        new QiniuConfigObject({
          enable: withP(keys.QINIU_ENABLE, loader),
          bucket: withP(keys.QINIU_BUCKET_NAME, loader),
          path: withP(keys.QINIU_PATH, loader),
          domain: withP(keys.QINIU_DOMAIN, loader),
          accessKey: withP(keys.QINIU_ACCESS_KEY, loader),
          secretKey: withP(keys.QINIU_SECRET_KEY, loader),
        }),
    );
  }

  static loadOr(prefix: 'videos' | 'images' | 'files' | 'chunks' | string = ''): QiniuConfigObject | null {
    const appendPrefix = (prefix.length ? `${prefix}_` : '').toUpperCase();
    Logger.log(`loadOr env: ${appendPrefix}${QiniuConfigKeys.QINIU_ENABLE}`);
    const enable = configLoader.loadBoolConfig(`${appendPrefix}${QiniuConfigKeys.QINIU_ENABLE}`);
    if (enable === true) {
      return QiniuConfigObject.load(prefix);
    }
    if (enable === false) {
      return null;
    }
    return Object.assign(QiniuConfigObject.load(), _.omitBy(QiniuConfigObject.load(prefix), _.isNull));
  }
}

export const MinioConfigKeys = {
  MINIO_ENABLE: 'MINIO_ENABLE',
  MINIO_MODE: 'MINIO_MODE',
  MINIO_ENDPOINT: 'MINIO_ENDPOINT',
  MINIO_PORT: 'MINIO_PORT',
  MINIO_USE_SSL: 'MINIO_USE_SSL',
  MINIO_ACCESS_KEY: 'MINIO_ACCESS_KEY',
  MINIO_SECRET_KEY: 'MINIO_SECRET_KEY',
};

export class MinioConfigObject {
  private static key = YamlConfigKeys.storage;
  private static prefix = `${MinioConfigObject.key}_`;

  private static logger = new Logger(resolveModule(fileURLToPath(import.meta.url), 'MinioConfigObject'));

  public enable: boolean;
  public mode: 'alioss-compatibility' | undefined;
  public endpoint: string;
  public port: number;
  public useSSL: boolean;
  public accessKey: string;

  @Expose({ name: 'with-secret-key', toPlainOnly: true })
  @Transform(({ value }) => !!value, { toPlainOnly: true })
  public secretKey: string;

  constructor(o: Partial<MinioConfigObject>) {
    Object.assign(this, plainToInstance(MinioConfigObject, o, { enableImplicitConversion: true }));
  }

  public static load(): MinioConfigObject {
    this.logger.verbose(`try load env: ${MinioConfigObject.prefix}${MinioConfigKeys.MINIO_ENABLE}`);
    return withP2(
      (p): any => configLoader.loadConfig2(MinioConfigObject.key, p),
      MinioConfigKeys,
      (loader, keys) =>
        new MinioConfigObject({
          enable: withP(keys.MINIO_ENABLE, loader),
          mode: withP(keys.MINIO_MODE, loader),
          endpoint: withP(keys.MINIO_ENDPOINT, loader),
          port: withP(keys.MINIO_PORT, loader),
          useSSL: withP(keys.MINIO_USE_SSL, loader),
          accessKey: withP(keys.MINIO_ACCESS_KEY, loader),
          secretKey: withP(keys.MINIO_SECRET_KEY, loader),
        }),
    );
  }
}

export const AliossConfigKeys = {
  ALIOSS_ENABLE: 'ALIOSS_ENABLE',
  ALIOSS_ACCESS_KEY: 'ALIOSS_ACCESS_KEY',
  ALIOSS_SECRET_KEY: 'ALIOSS_SECRET_KEY',
  ALIOSS_REGION: 'ALIOSS_REGION',
  ALIOSS_DEFAULT_BUCKET: 'ALIOSS_DEFAULT_BUCKET',
};

export class AliossConfigObject {
  private static key = YamlConfigKeys.storage;
  private static prefix = `${AliossConfigObject.key}_`;

  private static logger = new Logger(resolveModule(fileURLToPath(import.meta.url), 'AliossConfigObject'));

  public enable: boolean;
  public region: string;
  public defaultBucket: string;
  public accessKey: string;

  @Expose({ name: 'with-secret-key', toPlainOnly: true })
  @Transform(({ value }) => !!value, { toPlainOnly: true })
  public secretKey: string;

  public constructor(o: Partial<AliossConfigObject>) {
    Object.assign(this, plainToInstance(AliossConfigObject, o, { enableImplicitConversion: true }));
  }

  public static load(): AliossConfigObject {
    this.logger.verbose(`try load env: ${AliossConfigObject.prefix}${AliossConfigKeys.ALIOSS_ENABLE}`);
    return withP2(
      (p): any => configLoader.loadConfig2(AliossConfigObject.key, p),
      AliossConfigKeys,
      (loader, keys) =>
        new AliossConfigObject({
          enable: withP(keys.ALIOSS_ENABLE, loader),
          defaultBucket: withP(keys.ALIOSS_DEFAULT_BUCKET, loader),
          region: withP(keys.ALIOSS_REGION, loader),
          accessKey: withP(keys.ALIOSS_ACCESS_KEY, loader),
          secretKey: withP(keys.ALIOSS_SECRET_KEY, loader),
        }),
    );
  }
}
