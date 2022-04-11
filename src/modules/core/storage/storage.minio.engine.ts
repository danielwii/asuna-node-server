import { AsunaErrorCode, AsunaException } from '@danielwii/asuna-helper/dist/exceptions';
import { LoggerFactory } from '@danielwii/asuna-helper/dist/logger/factory';
import { r } from '@danielwii/asuna-helper/dist/serializer';

import { instanceToPlain } from 'class-transformer';
import * as fs from 'fs-extra';
import * as mime from 'mime-types';
import * as minio from 'minio';
import { join } from 'path';

import { convertFilename } from '../../common/helpers';
import { Global } from '../global';
import { UploaderConfigObject } from '../uploader/config';
import { getS3Region, isS3Endpoint } from './helper';
import { MinioConfigObject } from './storage.config';
import { FileInfo, IStorageEngine, ResolverOpts, SavedFile, StorageMode, yearMonthStr } from './storage.engines';

import type { Response } from 'express';

const logger = LoggerFactory.getLogger('MinioStorage');

export class MinioStorage implements IStorageEngine {
  private readonly defaultBucket;
  private readonly config = UploaderConfigObject.load();

  private readonly configObject: MinioConfigObject;

  public constructor(configure: () => MinioConfigObject, opts: { defaultBucket?: string } = {}) {
    this.defaultBucket = opts.defaultBucket || 'default';
    this.configObject = configure();
    if (this.configObject.enable !== true) {
      throw new Error(
        `minio must enable when using minio storage engine: ${r({
          configs: instanceToPlain(this.configObject),
          opts,
        })}`,
      );
    }
    logger.log(`[constructor] init ${r({ configs: instanceToPlain(this.configObject), opts })}`);
  }

  public get region(): string {
    return isS3Endpoint(this.configObject.endpoint) ? getS3Region(this.configObject.endpoint) : null;
  }

  public get client(): minio.Client {
    return new minio.Client({
      endPoint: this.configObject.endpoint,
      port: this.configObject.port,
      region: this.region,
      useSSL: !!this.configObject.useSSL,
      accessKey: this.configObject.accessKey,
      secretKey: this.configObject.secretKey,
    });
  }

  public async resolveUrl(opts: ResolverOpts): Promise<string>;
  public async resolveUrl(opts: ResolverOpts, res: Response): Promise<void>;
  public async resolveUrl(opts: ResolverOpts, res?: Response): Promise<string | void> {
    if (!res) throw new AsunaException(AsunaErrorCode.Unprocessable, 'not implemented for non-res exists.');

    const { filename, bucket, prefix, resolver } = opts;
    const pathname = join(bucket ?? this.defaultBucket, prefix ?? '', filename);
    const url = await resolver(pathname);
    logger.verbose(
      `resolveUrl ${r({ bucket: bucket ?? this.defaultBucket, prefix: prefix ?? '', filename, pathname, url })}`,
    );
    return res.redirect(url);
    // resolver(join(bucket || this.defaultBucket, prefix || '', filename)).then(url => res.redirect(url));
    // return resolver(join(bucket || this.defaultBucket, prefix || '', filename));
  }

  public async saveEntity(
    file: FileInfo,
    opts: { bucket?: string; prefix?: string; region?: string } = {},
  ): Promise<SavedFile> {
    logger.log(`save entity ${r({ file, opts, config: this.configObject })}`);
    const isS3 = isS3Endpoint(this.configObject.endpoint);
    const bucket = opts.bucket ?? this.defaultBucket;
    const prefix = opts.prefix ?? yearMonthStr();
    const region = opts.region ?? this.region ?? 'local';

    logger.log(`info ${r({ isS3, bucket, prefix, region })}`);

    if (!isS3) {
      const items: minio.BucketItemFromList[] = await this.client.listBuckets().catch((reason) => {
        logger.error(`list buckets error ${r(reason)}`);
        throw reason;
      });
      logger.log(`found buckets: ${r(items)} current is ${bucket}`);
      if (!items?.find((item) => item.name === bucket)) {
        logger.log(`create bucket [${bucket}] for region [${region}]`);
        await this.client.makeBucket(bucket, region);
      }
      if (!bucket.startsWith('private-')) {
        logger.log(`bucket [${bucket}] is not private, set anonymous access policy`);
        await this.client.setBucketPolicy(
          bucket,
          JSON.stringify({
            Version: '2012-10-17',
            Statement: [
              {
                Effect: 'Allow',
                Principal: '*',
                Action: ['s3:GetObject'],
                Resource: [`arn:aws:s3:::${bucket}/*`],
                /*
                Condition: {
                  StringEquals: {
                    's3:ExistingObjectTag/public': 'yes',
                  },
                }, */
              },
            ],
          }),
        );
      }
    }

    // remove head and tail chars '/' in prefix
    const resolvedPrefix = (prefix || '').replace(/^\/+/, '').replace(/\/+$/, '').replace(/\/+/g, '/').trim();
    const filename = convertFilename(file.filename);
    const filenameWithPrefix = join(resolvedPrefix, filename);

    logger.log(`put ${r({ file, filenameWithPrefix, resolvedPrefix, bucket })}`);
    const mimetype = mime.lookup(file.filename) || file.mimetype;
    const eTag = await this.client.fPutObject(bucket, filenameWithPrefix, file.path, { 'Content-Type': mimetype });

    logger.log(`[saveEntity] [${r(eTag)}] ...`);
    (async () => {
      try {
        logger.log(`remove local file ${file.path}`);
        fs.removeSync(file.path);

        const parent = join(file.path, '../');
        logger.log(`removed: ${file.path}, check parent: ${parent}`);
        const files = fs.readdirSync(parent);
        if (files.length === 0) {
          logger.log(`no more files in ${parent}, remove it.`);
          fs.remove(parent).catch((reason) => logger.warn(`remove ${parent} error: ${r(reason)}`));
        }
      } catch (e) {
        logger.error(`clean temp files error: ${e}`);
      }
    })().catch((reason) => logger.error(reason));

    return new SavedFile({
      prefix: resolvedPrefix,
      path: filenameWithPrefix,
      bucket,
      // region,
      mimetype,
      mode: StorageMode.MINIO,
      filename,
      fullpath: join(this.config.resourcePath, bucket, resolvedPrefix, filename),
    });
  }

  public listEntities({ bucket, prefix }: { bucket?: string; prefix?: string }): Promise<SavedFile[]> {
    const currentBucket = bucket || this.defaultBucket;
    return new Promise<SavedFile[]>((resolve) => {
      const savedFiles: SavedFile[] = [];
      logger.log(`list entities ${r({ currentBucket, prefix })}`);
      const bucketStream = this.client.listObjectsV2(currentBucket, prefix, true);
      bucketStream.on('data', (item) => {
        logger.log(`bucketStream on data ${r(item)}`);
        const filename = item.name.slice(prefix.length + 1);
        savedFiles.push(
          new SavedFile({
            bucket: currentBucket,
            path: `${item.prefix}/${item.name}`,
            size: item.size,
            prefix,
            filename, // item.name 是包含 prefix 的完成名字
            mode: StorageMode.MINIO,
            fullpath: join(this.config.resourcePath, currentBucket, prefix, filename),
          }),
        );
      });
      bucketStream.on('end', () => {
        logger.log('bucketStream on end');
        return resolve(
          savedFiles.sort(
            (a, b) =>
              Number(a.filename.slice(a.filename.lastIndexOf('.'))) -
              Number(b.filename.slice(b.filename.lastIndexOf('.'))),
          ),
        );
      });
      bucketStream.on('error', (error) => {
        logger.log(`bucketStream on error ${r(error)}`);
        throw new Error(r(error));
      });
    });
  }

  public getEntity(fileInfo: SavedFile, destDirectory?: string): Promise<string> {
    const bucket = fileInfo.bucket || this.defaultBucket;
    const objectName = join(fileInfo.prefix, fileInfo.filename);
    const filepath = join(destDirectory || Global.tempPath, fileInfo.bucket, objectName);
    logger.log(`get entity from ${r({ bucket, objectName, filepath })}`);
    return this.client.fGetObject(bucket, objectName, filepath).then(() => filepath);
  }

  public async removeEntities({
    bucket,
    prefix,
    filename,
  }: {
    bucket?: string;
    prefix?: string;
    filename?: string;
  }): Promise<void> {
    const currentBucket = bucket || this.defaultBucket;
    logger.log(`remove entities ${r({ bucket, prefix, filename, currentBucket })}`);
    const fileInfos = await this.listEntities({ bucket, prefix: join(prefix, filename) });
    return this.client.removeObjects(
      bucket,
      fileInfos.map((fileInfo) => join(fileInfo.prefix, fileInfo.filename)),
    );
  }
}
