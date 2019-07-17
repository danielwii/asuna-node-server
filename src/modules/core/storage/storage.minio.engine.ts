import { Logger } from '@nestjs/common';
import { classToPlain } from 'class-transformer';
import { oneLineTrim } from 'common-tags';
import * as fsExtra from 'fs-extra';
import * as minio from 'minio';
import { join } from 'path';
import { AsunaError, AsunaException } from '../../common';
import { r } from '../../common/helpers';
import { ConfigKeys, configLoader } from '../config.helper';
import { AsunaContext } from '../context';
import { JpegParam } from '../image/jpeg.pipe';
import { ThumbnailParam } from '../image/thumbnail.pipe';
import { MinioConfigObject } from './storage.config';
import {
  convertFilename,
  FileInfo,
  IStorageEngine,
  SavedFile,
  StorageMode,
  yearMonthStr,
} from './storage.engines';

export class MinioStorage implements IStorageEngine {
  private static readonly logger = new Logger(MinioStorage.name);

  private readonly defaultBucket;
  private readonly configObject: MinioConfigObject;

  constructor(configLoader: () => MinioConfigObject, opts: { defaultBucket?: string } = {}) {
    this.defaultBucket = opts.defaultBucket || 'default';
    this.configObject = configLoader();
    if (this.configObject.enable !== true) {
      throw new Error(
        `minio must enable when using minio storage engine: ${r({
          configs: classToPlain(this.configObject),
          opts,
        })}`,
      );
    }
    MinioStorage.logger.log(
      `[constructor] init ${r({ configs: classToPlain(this.configObject), opts })}`,
    );
    /*
    Hermes.setupJobProcessor(AsunaSystemQueue.UPLOAD, (job: Job) => {
      const { bucket, filenameWithPrefix, file } = job.data;
      return this.client
        .fPutObject(bucket, filenameWithPrefix, file.path, {
          'Content-Type': file.mimetype,
        })
        .then(uploaded => {
          MinioStorage.logger.log(`[saveEntity] [${uploaded}] ...`);
          return uploaded;
        })
        .catch(error => {
          MinioStorage.logger.error(
            `[saveEntity] [${filenameWithPrefix}] error: ${error}`,
            error.trace,
          );
          return error;
        });
    });*/
    /*
    Hermes.setupJobProcessor(AsunaSystemQueue.IN_MEMORY_UPLOAD, payload => {
      MinioStorage.logger.log(`upload ${r(payload)}`);
      const { bucket, filenameWithPrefix, file } = payload;
      return this.client
        .fPutObject(bucket, filenameWithPrefix, file.path, {
          'Content-Type': file.mimetype,
        })
        .then(etag => {
          MinioStorage.logger.log(`[saveEntity] [${etag}] ...`);

          MinioStorage.logger.log(`remove local file ${file.path}`);
          fsExtra
            .remove(file.path)
            .then(() => {
              const parent = join(file.path, '../');
              MinioStorage.logger.log(`removed: ${file.path}, check parent: ${parent}`);
              fsExtra.readdir(parent).then(files => {
                if (files.length === 0) {
                  MinioStorage.logger.log(`no more files in ${parent}, remove it.`);
                  fsExtra
                    .remove(parent)
                    .catch(reason =>
                      MinioStorage.logger.warn(`remove ${parent} error: ${r(reason)}`),
                    );
                }
              });
            })
            .catch(reason => MinioStorage.logger.warn(`remove ${file.path} error: ${r(reason)}`));
          return etag;
        })
        .catch(error => {
          MinioStorage.logger.error(
            `[saveEntity] [${filenameWithPrefix}] error: ${error}`,
            error.trace,
          );
          return error;
        });
    })*/
  }

  get client() {
    return new minio.Client({
      endPoint: this.configObject.endpoint,
      port: this.configObject.port,
      useSSL: this.configObject.useSSL,
      accessKey: this.configObject.accessKey,
      secretKey: this.configObject.secretKey,
    });
  }

  resolveUrl(
    {
      filename,
      bucket,
      prefix,
      thumbnailConfig,
      jpegConfig,
      resolver,
    }: {
      filename: string;
      bucket?: string;
      prefix?: string;
      thumbnailConfig?: { opts: ThumbnailParam; param?: string };
      jpegConfig?: { opts: JpegParam; param?: string };
      resolver?: (url: string) => Promise<any>;
    },
    res,
  ) {
    return resolver(join(bucket || this.defaultBucket, prefix || '', filename));
  }

  async saveEntity(
    file: FileInfo,
    opts: { bucket?: string; prefix?: string; region?: string } = {},
  ): Promise<SavedFile> {
    const bucket = opts.bucket || this.defaultBucket;
    const prefix = opts.prefix || yearMonthStr();
    const region = opts.region || 'local';
    const items: minio.BucketItemFromList[] = await this.client.listBuckets();
    MinioStorage.logger.log(`found buckets: ${r(items)} current is ${bucket}`);
    if (!(items && items.find(item => item.name === bucket))) {
      MinioStorage.logger.log(`create bucket [${bucket}] for region [${region}]`);
      await this.client.makeBucket(bucket, region);
    }

    if (!bucket.startsWith('private-')) {
      MinioStorage.logger.log(`bucket [${bucket}] is not private, set anonymous access policy`);
      await this.client.setBucketPolicy(
        bucket,
        JSON.stringify({
          Version: '2012-10-17',
          Statement: [
            {
              Action: ['s3:GetObject'],
              Effect: 'Allow',
              Principal: {
                AWS: ['*'],
              },
              Resource: ['arn:aws:s3:::*'],
            },
          ],
        }),
      );
    }

    // remove head and tail chars '/' in prefix
    const resolvedPrefix = (prefix || '')
      .replace(/^\/+/, '')
      .replace(/\/+$/, '')
      .replace(/\/+/g, '/')
      .trim();
    const filename = convertFilename(file.filename);
    const filenameWithPrefix = join(resolvedPrefix, filename);

    MinioStorage.logger.log(oneLineTrim`
      put ${r(file)} to [${filenameWithPrefix}] with prefix [${resolvedPrefix}] 
      and bucket [${bucket}].
    `);
    return this.client
      .fPutObject(bucket, filenameWithPrefix, file.path, {
        'Content-Type': file.mimetype,
      })
      .then(etag => {
        MinioStorage.logger.log(`[saveEntity] [${etag}] ...`);

        MinioStorage.logger.log(`remove local file ${file.path}`);
        fsExtra
          .remove(file.path)
          .then(() => {
            const parent = join(file.path, '../');
            MinioStorage.logger.log(`removed: ${file.path}, check parent: ${parent}`);
            fsExtra.readdir(parent).then(files => {
              if (files.length === 0) {
                MinioStorage.logger.log(`no more files in ${parent}, remove it.`);
                fsExtra
                  .remove(parent)
                  .catch(reason =>
                    MinioStorage.logger.warn(`remove ${parent} error: ${r(reason)}`),
                  );
              }
            });
          })
          .catch(reason => MinioStorage.logger.warn(`remove ${file.path} error: ${r(reason)}`));
        return new SavedFile({
          prefix: resolvedPrefix,
          path: filenameWithPrefix,
          bucket,
          region,
          mimetype: file.mimetype,
          mode: StorageMode.MINIO,
          filename,
          fullpath: join(
            configLoader.loadConfig(ConfigKeys.RESOURCE_PATH, '/uploads'),
            bucket,
            resolvedPrefix,
            filename,
          ),
        });
        // return etag;
      })
      .catch(error => {
        MinioStorage.logger.error(
          `[saveEntity] [${filenameWithPrefix}] error: ${error}`,
          error.trace,
        );
        throw new AsunaException(AsunaError.Unprocessable, error);
      });
    /*
    Hermes.getInMemoryQueue(AsunaSystemQueue.IN_MEMORY_UPLOAD).next({
      bucket,
      filenameWithPrefix,
      file,
    });*/
    /*
    const { queue } = Hermes.getQueue(AsunaSystemQueue.UPLOAD);
    queue
      .add(
        { bucket, filenameWithPrefix, file },
        { attempts: 3, backoff: { delay: 60_000, type: 'exponential' }, timeout: 60_000 * 10 },
      )
      .catch(reason => {
        MinioStorage.logger.error(
          // TODO trigger event when job failed
          `upload error: ${r(reason)}, should trigger an event later.`,
        );
      });*/
    /*
    return {
      prefix: resolvedPrefix,
      bucket,
      region,
      mimetype: file.mimetype,
      mode: StorageMode.MINIO,
      filename,
    };*/
  }

  listEntities({ bucket, prefix }: { bucket?: string; prefix?: string }): Promise<SavedFile[]> {
    const currentBucket = bucket || this.defaultBucket;
    return new Promise<SavedFile[]>(resolve => {
      const savedFiles: SavedFile[] = [];
      MinioStorage.logger.log(`list entities ${r({ currentBucket, prefix })}`);
      const bucketStream = this.client.listObjectsV2(currentBucket, prefix, true);
      bucketStream.on('data', item => {
        MinioStorage.logger.log(`bucketStream on data ${r(item)}`);
        const filename = item.name.slice(prefix.length + 1);
        savedFiles.push(
          new SavedFile({
            bucket: currentBucket,
            path: `${item.prefix}/${item.name}`,
            size: item.size,
            prefix,
            filename, // item.name 是包含 prefix 的完成名字
            mode: StorageMode.MINIO,
            fullpath: join(
              configLoader.loadConfig(ConfigKeys.RESOURCE_PATH, '/uploads'),
              currentBucket,
              prefix,
              filename,
            ),
          }),
        );
      });
      bucketStream.on('end', () => {
        MinioStorage.logger.log('bucketStream on end');
        return resolve(
          savedFiles.sort(
            (a, b) =>
              +a.filename.slice(a.filename.lastIndexOf('.')) -
              +b.filename.slice(b.filename.lastIndexOf('.')),
          ),
        );
      });
      bucketStream.on('error', error => {
        MinioStorage.logger.log(`bucketStream on error ${r(error)}`);
        throw new Error(r(error));
      });
    });
  }

  getEntity(fileInfo: SavedFile, destDirectory?: string): Promise<string> {
    const bucket = fileInfo.bucket || this.defaultBucket;
    const objectName = join(fileInfo.prefix, fileInfo.filename);
    const filepath = join(
      destDirectory || AsunaContext.instance.tempPath,
      fileInfo.bucket,
      objectName,
    );
    MinioStorage.logger.log(`get entity from ${r({ bucket, objectName, filepath })}`);
    return this.client.fGetObject(bucket, objectName, filepath).then(() => filepath);
  }

  async removeEntities({
    bucket,
    prefix,
    filename,
  }: {
    bucket?: string;
    prefix?: string;
    filename?: string;
  }) {
    const currentBucket = bucket || this.defaultBucket;
    MinioStorage.logger.log(`remove entities ${r({ bucket, prefix, filename })}`);
    const fileInfos = await this.listEntities({ bucket, prefix: join(prefix, filename) });
    return this.client.removeObjects(
      bucket,
      fileInfos.map(fileInfo => join(fileInfo.prefix, fileInfo.filename)),
    );
  }
}
