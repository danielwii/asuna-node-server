import { Exclude } from 'class-transformer';
import { configLoader } from '../../sys';

export const QiniuConfigKeys = {
  STORAGE: 'STORAGE',
  QINIU_ACCESS_KEY: 'QINIU_ACCESS_KEY',
  QINIU_SECRET_KEY: 'QINIU_SECRET_KEY',
  QINIU_BUCKET_NAME: 'QINIU_BUCKET_NAME',
  QINIU_PREFIX: 'QINIU_PREFIX',
  QINIU_DOMAIN: 'QINIU_DOMAIN',
};

export class QiniuConfigObject {
  bucket: string;
  prefix: string;
  domain: string;

  @Exclude()
  accessKey: string;
  @Exclude()
  secretKey: string;

  constructor(partial: Partial<QiniuConfigObject>) {
    Object.assign(this, partial);
  }

  static load(type: 'video' | 'image' | 'file'): QiniuConfigObject {
    return new QiniuConfigObject({
      bucket: configLoader.loadConfig(`${type.toUpperCase()}_${QiniuConfigKeys.QINIU_BUCKET_NAME}`),
      prefix: configLoader.loadConfig(`${type.toUpperCase()}_${QiniuConfigKeys.QINIU_PREFIX}`),
      domain: configLoader.loadConfig(`${type.toUpperCase()}_${QiniuConfigKeys.QINIU_DOMAIN}`),
      accessKey: configLoader.loadConfig(
        `${type.toUpperCase()}_${QiniuConfigKeys.QINIU_ACCESS_KEY}`,
      ),
      secretKey: configLoader.loadConfig(
        `${type.toUpperCase()}_${QiniuConfigKeys.QINIU_SECRET_KEY}`,
      ),
    });
  }
}

export const MinioConfigKeys = {
  MINIO_ENABLE: 'MINIO_ENABLE',
  MINIO_ENDPOINT: 'MINIO_ENDPOINT',
  MINIO_PORT: 'MINIO_PORT',
  MINIO_USE_SSL: 'MINIO_USE_SSL',
  MINIO_ACCESS_KEY: 'MINIO_ACCESS_KEY',
  MINIO_SECRET_KEY: 'MINIO_SECRET_KEY',
};

export class MinioConfigObject {
  enable: boolean;
  endpoint: string;
  port: number;
  useSSL: boolean;

  @Exclude()
  accessKey: string;
  @Exclude()
  secretKey: string;

  constructor(partial: Partial<MinioConfigObject>) {
    Object.assign(this, partial);
  }

  static load(): MinioConfigObject {
    return new MinioConfigObject({
      enable: configLoader.loadBoolConfig(MinioConfigKeys.MINIO_ENABLE, false),
      endpoint: configLoader.loadConfig(MinioConfigKeys.MINIO_ENDPOINT, 'minio'),
      port: configLoader.loadNumericConfig(MinioConfigKeys.MINIO_PORT, 9000),
      useSSL: configLoader.loadBoolConfig(MinioConfigKeys.MINIO_USE_SSL, false),
      accessKey: configLoader.loadConfig(MinioConfigKeys.MINIO_ACCESS_KEY),
      secretKey: configLoader.loadConfig(MinioConfigKeys.MINIO_SECRET_KEY),
    });
  }
}
