import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { classToPlain } from 'class-transformer';
import { oneLineTrim } from 'common-tags';
import * as fsExtra from 'fs-extra';
import * as _ from 'lodash';
import * as minio from 'minio';
import { join } from 'path';
import * as qiniu from 'qiniu';
import * as sharp from 'sharp';
import * as util from 'util';
import { AsunaSystemQueue, Hermes } from '../../bus';
import { renderObject } from '../../logger';

import { ErrorException } from '../base';
import { AsunaContext } from '../context';
import { JpegParam } from '../image/jpeg.pipe';
import { ThumbnailParam } from '../image/thumbnail.pipe';
import { MinioConfigObject, QiniuConfigObject } from './config.object';

export enum StorageMode {
  LOCAL = 'local',
  QINIU = 'qiniu',
  MINIO = 'minio',
}

export interface IStorageEngine {
  saveEntity(
    file: { filename: string; path: string; mimetype: string },
    opts: { bucket?: string; prefix?: string; region?: string },
  ): Promise<SavedFile>;

  resolve(
    {
      filename,
      bucket,
      prefix,
      thumbnailConfig,
      jpegConfig,
      resolver,
    }: {
      filename: string;
      bucket: string;
      prefix?: string;
      thumbnailConfig?: { opts: ThumbnailParam; param?: string };
      jpegConfig?: { opts: JpegParam; param?: string };
      resolver?: (url: string) => Promise<any>;
    },
    res?,
  ): Promise<any>;
}

export interface SavedFile {
  bucket?: string; // default: 'default'
  region?: string; // default: 'local'
  prefix: string;
  mode: StorageMode;
  mimetype: string;
  filename: string;
}

function yearMonthStr() {
  const now = new Date();
  return `${now.getFullYear()}/${now.getMonth() + 1}`;
}

function convertFilename(filename: string) {
  return filename.replace(/[^\w\._]+/g, '_');
}

export class LocalStorage implements IStorageEngine {
  private static readonly logger = new Logger(LocalStorage.name);

  private readonly storagePath: string;
  private readonly bucket: string;

  constructor(storagePath: string, defaultBucket: string = 'default') {
    this.bucket = defaultBucket || 'default';
    this.storagePath = storagePath;
    LocalStorage.logger.log(oneLineTrim`
      [constructor] init default[${this.bucket}] storage path: '${this.storagePath}/${this.bucket}'
    `);
    fsExtra.mkdirs(join(this.storagePath, this.bucket));
  }

  saveEntity(
    file,
    opts: { bucket?: string; prefix?: string; region?: string } = {},
  ): Promise<SavedFile> {
    if (!file) {
      throw new ErrorException('LocalStorage', 'file must not be null.');
    }
    const bucket = opts.bucket || this.bucket || 'default';
    const prefix = opts.prefix || yearMonthStr();
    const filename = convertFilename(file.filename);
    const dest = join(this.storagePath, bucket, prefix, filename);
    LocalStorage.logger.log(`file is '${JSON.stringify({ file, dest }, null, 2)}'`);

    fsExtra.moveSync(file.path, dest);
    return Promise.resolve({
      bucket,
      prefix,
      mimetype: file.mimetype,
      mode: StorageMode.LOCAL,
      filename,
    });
  }

  public resolve({ filename, bucket, prefix, thumbnailConfig, jpegConfig }, res): Promise<any> {
    const fullFilePath = join(AsunaContext.instance.uploadPath, bucket, prefix, filename);
    if (!fullFilePath.startsWith(AsunaContext.instance.uploadPath)) {
      throw new Error('filePath must startsWith upload-path');
    }
    LocalStorage.logger.log(
      util.inspect({ filename, prefix, bucket, thumbnailConfig, jpegConfig }, { colors: true }),
    );

    const ext = _.last(fullFilePath.split('.'));
    const fullFileDir = fullFilePath.slice(0, -1 - ext.length);
    let outputFilename = 'compressed';
    if (thumbnailConfig.param) {
      outputFilename += `@${thumbnailConfig.param.replace('/', ':')}`;
    }
    if (jpegConfig.param) {
      outputFilename += `@${jpegConfig.param.replace('/', ':')}`;
    }
    const outputPath = `${fullFileDir}/${outputFilename}.${ext}`;

    if (!['png', 'jpg', 'jpeg'].includes(ext)) {
      if (fsExtra.existsSync(outputPath)) {
        return res.type(ext).sendFile(fullFilePath);
      }
      return res.status(404).send();
    }

    LocalStorage.logger.log(`check if ${ext} file outputPath '${outputPath}' exists`);
    if (fsExtra.existsSync(outputPath)) {
      return res.type(ext).sendFile(outputPath);
    }

    fsExtra.mkdirpSync(fullFileDir);
    LocalStorage.logger.log(`create outputPath '${outputPath}' for file '${fullFilePath}'`);
    const imageProcess = sharp(fullFilePath);
    if (thumbnailConfig) {
      imageProcess.resize(thumbnailConfig.opts.width, thumbnailConfig.opts.height, {
        fit: thumbnailConfig.opts.fit,
      });
    }
    if (['jpg', 'jpeg'].includes(ext)) {
      imageProcess.jpeg(jpegConfig.opts);
    }
    imageProcess.toFile(outputPath, (err, info) => {
      if (err) {
        LocalStorage.logger.error(
          `create outputPath image error ${util.inspect(
            { outputPath, err: err.stack, info },
            { colors: true },
          )}`,
        );
        res.status(404).send(err.message);
      } else {
        res.type(ext).sendFile(outputPath);
      }
    });
  }
}

export class BucketStorage {
  private static readonly logger = new Logger(BucketStorage.name);

  private rootBucket: string = 'buckets';
  private storagePath: string;

  constructor(storagePath: string) {
    this.storagePath = join(storagePath, this.rootBucket);
    BucketStorage.logger.log(`[constructor] init storage path: '${this.storagePath}'`);
    fsExtra.mkdirs(this.storagePath);
  }

  public buckets(): Promise<string[]> {
    return Promise.resolve(fsExtra.readdirSync(this.storagePath));
  }

  public createBucket(name: string): Promise<any> {
    if (!name) {
      throw new ErrorException('BucketStorage', 'bucket name cannot be empty.');
    }
    if (name.includes('/')) {
      throw new ErrorException('BucketStorage', 'bucket name cannot be ');
    }
    return Promise.resolve(fsExtra.mkdirsSync(join(this.storagePath, name)));
  }

  public deleteBucket(name: string): Promise<any> {
    if (!name) {
      throw new ErrorException('BucketStorage', 'bucket name cannot be empty.');
    }
    return Promise.resolve(fsExtra.rmdirSync(join(this.storagePath, name)));
  }

  public listEntities(bucketName: string): Promise<any> {
    if (!bucketName) {
      throw new ErrorException('BucketStorage', 'bucket name cannot be empty.');
    }
    return Promise.resolve(fsExtra.readFileSync(join(this.storagePath, bucketName)));
  }

  public saveEntity(bucketName: string, file): Promise<any> {
    if (!bucketName) {
      throw new ErrorException('BucketStorage', 'bucket name cannot be empty.');
    }
    if (!file) {
      throw new ErrorException('BucketStorage', 'file must not be null.');
    }

    if (!file) {
      throw new ErrorException('LocalStorage', 'file must not be null.');
    }

    const now = new Date();
    const prefix = `${now.getFullYear()}/${now.getMonth()}`;
    const filename = convertFilename(file.filename);
    const dest = join(this.storagePath, bucketName, prefix, filename);
    BucketStorage.logger.log(`file is '${JSON.stringify({ file, dest }, null, 2)}'`);

    fsExtra.moveSync(file.path, dest);
    return Promise.resolve({
      prefix,
      bucket: `${this.rootBucket}/${bucketName}`,
      mimetype: file.mimetype,
      mode: StorageMode.LOCAL,
      filename,
    });
  }
}

export class MinioStorage implements IStorageEngine {
  private static readonly logger = new Logger(MinioStorage.name);

  private readonly defaultBucket;

  constructor(
    private configLoader: () => MinioConfigObject,
    opts: { defaultBucket?: string } = {},
  ) {
    this.defaultBucket = opts.defaultBucket || 'default';
    MinioStorage.logger.log(
      `[constructor] init ${renderObject({ configs: classToPlain(configLoader()), opts })}`,
    );

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
    });
  }

  get client() {
    const config = this.configLoader();
    return new minio.Client({
      endPoint: config.endpoint,
      port: config.port,
      useSSL: config.useSSL,
      accessKey: config.accessKey,
      secretKey: config.secretKey,
    });
  }

  resolve(
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
  ): Promise<any> {
    return resolver(join(bucket || this.defaultBucket, prefix || '', filename));
  }

  async saveEntity(
    file,
    opts: { bucket?: string; prefix?: string; region?: string } = {},
  ): Promise<SavedFile> {
    const bucket = opts.bucket || this.defaultBucket;
    const prefix = opts.prefix || yearMonthStr();
    const region = opts.region || 'local';
    const items: minio.BucketItemFromList[] = await this.client.listBuckets();
    MinioStorage.logger.log(`found buckets: ${renderObject(items)}`);
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
      put ${renderObject(file)} to [${filenameWithPrefix}] with prefix [${resolvedPrefix}] 
      and bucket [${bucket}], add upload job to queue(${AsunaSystemQueue.UPLOAD})
    `);

    const { queue } = Hermes.getQueue(AsunaSystemQueue.UPLOAD);
    queue
      .add(
        { bucket, filenameWithPrefix, file },
        { attempts: 3, backoff: { delay: 60_000, type: 'exponential' }, timeout: 60_000 * 10 },
      )
      .catch(reason => {
        MinioStorage.logger.error(
          // TODO trigger event when job failed
          `upload error: ${renderObject(reason)}, should trigger an event later.`,
        );
      });
    return {
      prefix: resolvedPrefix,
      bucket,
      region,
      mimetype: file.mimetype,
      mode: StorageMode.MINIO,
      filename,
    };
  }
}

export class QiniuStorage implements IStorageEngine {
  private static readonly logger = new Logger(QiniuStorage.name);

  // private temp: string;
  private readonly mac: qiniu.auth.digest.Mac;

  constructor(private configLoader: () => QiniuConfigObject) {
    const config = configLoader();
    QiniuStorage.logger.log(
      `[constructor] init [${config.bucket}] with default prefix:${config.prefix} ...`,
    );
    // this.temp = fsExtra.mkdtempSync('temp');
    this.mac = new qiniu.auth.digest.Mac(config.accessKey, config.secretKey);
  }

  public saveEntity(
    file,
    opts: { bucket?: string; prefix?: string; region?: string } = {},
  ): Promise<SavedFile> {
    if (!file) {
      throw new ErrorException('QiniuStorage', 'file must not be null.');
    }

    return new Promise<SavedFile>(resolve => {
      const config = this.configLoader();
      const bucket = opts.bucket;
      const prefix = opts.prefix || yearMonthStr();
      const filename = convertFilename(file.filename);
      const filenameWithPrefix = join(prefix, filename);
      const key = join(bucket, filenameWithPrefix);
      QiniuStorage.logger.log(`upload file to '${config.bucket}' as '${key}'`);
      const uploadToken = new qiniu.rs.PutPolicy({ scope: config.bucket }).uploadToken(this.mac);

      new qiniu.form_up.FormUploader().putFile(
        uploadToken,
        key,
        file.path,
        new qiniu.form_up.PutExtra(),
        (err, body, info) => {
          if (err) {
            throw new ErrorException('QiniuStorage', `upload file '${key}' error`, err);
          }
          if (info.statusCode === 200) {
            QiniuStorage.logger.log(
              `upload file '${JSON.stringify({ key, info, body }, null, 2)}'`,
            );
            resolve({
              prefix,
              bucket: config.bucket,
              mimetype: file.mimetype,
              mode: StorageMode.QINIU,
              filename,
            });
          } else {
            throw new ErrorException('QiniuStorage', `upload file '${key}' error`, {
              info,
              body,
            });
          }
        },
      );
    });
  }

  public resolve(
    {
      filename,
      bucket,
      prefix,
      thumbnailConfig,
      jpegConfig,
    }: {
      filename: string;
      bucket: string;
      prefix?: string;
      thumbnailConfig?: { opts: ThumbnailParam; param?: string };
      jpegConfig?: { opts: JpegParam; param?: string };
    },
    res,
  ): Promise<any> {
    return Promise.resolve(join(bucket, prefix, filename));
  }
}
