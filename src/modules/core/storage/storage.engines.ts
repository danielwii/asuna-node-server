import { Logger } from '@nestjs/common';
import * as fsExtra from 'fs-extra';
import * as _ from 'lodash';
import * as path from 'path';
import { join } from 'path';
import * as qiniu from 'qiniu';
import * as sharp from 'sharp';
import * as util from 'util';

import { AdminModule } from '../../admin.module';

import { ErrorException } from '../../base';
import { JpegParam } from '../image/jpeg.pipe';
import { ThumbnailParam } from '../image/thumbnail.pipe';

export enum StorageMode {
  LOCAL = 'local',
  QINIU = 'qiniu',
}

export interface IStorageEngine {
  saveEntity(file, overwritePrefix?: string): Promise<SavedFile>;

  resolve(
    {
      filename,
      bucket,
      prefix,
      thumbnailConfig,
      jpegConfig,
    }: {
      filename: string;
      bucket: string;
      prefix: string;
      thumbnailConfig?: { opts: ThumbnailParam; param?: string };
      jpegConfig?: { opts: JpegParam; param?: string };
    },
    res,
  ): Promise<any>;
}

export interface SavedFile {
  bucket?: string; // default: 'default'
  prefix: string;
  mode: StorageMode;
  mimetype: string;
  filename: string;
}

function yearMonthStr() {
  const now = new Date();
  return `${now.getFullYear()}/${now.getMonth()}`;
}

export class LocalStorage implements IStorageEngine {
  private static readonly logger = new Logger(LocalStorage.name);

  private storagePath: string;

  constructor(storagePath: string, bucket: string = 'default') {
    this.storagePath = path.join(storagePath, bucket || 'default');
    LocalStorage.logger.log(
      `[constructor] init default[${bucket}] storage path: '${this.storagePath}'`,
    );
    fsExtra.mkdirs(this.storagePath);
  }

  saveEntity(file, overwritePrefix?: string): Promise<SavedFile> {
    if (!file) {
      throw new ErrorException('LocalStorage', 'file must not be null.');
    }

    const prefix = `${overwritePrefix ? `${overwritePrefix}/` : ''}${yearMonthStr()}`;
    const dest = path.join(this.storagePath, prefix, file.filename);
    LocalStorage.logger.log(`file is '${JSON.stringify({ file, dest }, null, 2)}'`);

    fsExtra.moveSync(file.path, dest);
    return Promise.resolve({
      prefix,
      mimetype: file.mimetype,
      mode: StorageMode.LOCAL,
      filename: file.filename,
    });
  }

  public resolve({ filename, bucket, prefix, thumbnailConfig, jpegConfig }, res): Promise<any> {
    const fullFilePath = path.join(AdminModule.uploadPath, bucket, prefix, filename);
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
        return res.status(404).send(err.message);
      } else {
        return res.type(ext).sendFile(outputPath);
      }
    });
  }
}

export class BucketStorage {
  private static readonly logger = new Logger(BucketStorage.name);

  private rootBucket: string = 'buckets';
  private storagePath: string;

  constructor(storagePath: string) {
    this.storagePath = path.join(storagePath, this.rootBucket);
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
      throw new ErrorException('BucketStorage', 'bucket name cannot be path.');
    }
    return Promise.resolve(fsExtra.mkdirsSync(path.join(this.storagePath, name)));
  }

  public deleteBucket(name: string): Promise<any> {
    if (!name) {
      throw new ErrorException('BucketStorage', 'bucket name cannot be empty.');
    }
    return Promise.resolve(fsExtra.rmdirSync(path.join(this.storagePath, name)));
  }

  public listEntities(bucketName: string): Promise<any> {
    if (!bucketName) {
      throw new ErrorException('BucketStorage', 'bucket name cannot be empty.');
    }
    return Promise.resolve(fsExtra.readFileSync(path.join(this.storagePath, bucketName)));
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
    const dest = path.join(this.storagePath, bucketName, prefix, file.filename);
    BucketStorage.logger.log(`file is '${JSON.stringify({ file, dest }, null, 2)}'`);

    fsExtra.moveSync(file.path, dest);
    return Promise.resolve({
      prefix,
      bucket: `${this.rootBucket}/${bucketName}`,
      mimetype: file.mimetype,
      mode: StorageMode.LOCAL,
      filename: file.filename,
    });
  }
}

export class QiniuStorage implements IStorageEngine {
  private static readonly logger = new Logger(QiniuStorage.name);

  // private temp: string;
  private mac: qiniu.auth.digest.Mac;

  constructor(
    private bucket: string,
    private prefix: string,
    accessKey: string,
    secretKey: string,
  ) {
    QiniuStorage.logger.log(`[constructor] init [${bucket}] with default prefix:${prefix} ...`);
    // this.temp = fsExtra.mkdtempSync('temp');
    this.mac = new qiniu.auth.digest.Mac(accessKey, secretKey);
  }

  public saveEntity(file, overwritePrefix?: string): Promise<SavedFile> {
    if (!file) {
      throw new ErrorException('QiniuStorage', 'file must not be null.');
    }

    return new Promise<SavedFile>(resolve => {
      const filename = file.filename;
      const filenameWithPrefix = join(yearMonthStr(), filename);
      const prefix = overwritePrefix ? overwritePrefix : this.prefix;
      const key = join(prefix, filenameWithPrefix);
      QiniuStorage.logger.log(`upload file to '${this.bucket}' as '${key}'`);
      const uploadToken = new qiniu.rs.PutPolicy({ scope: this.bucket }).uploadToken(this.mac);

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
              bucket: this.bucket,
              mimetype: file.mimetype,
              mode: StorageMode.QINIU,
              filename: filenameWithPrefix,
            });
          } else {
            throw new ErrorException('QiniuStorage', `upload file '${key}' error`, { info, body });
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
      prefix: string;
      thumbnailConfig: { opts: ThumbnailParam; param?: string };
      jpegConfig: { opts: JpegParam; param?: string };
    },
    res,
  ): Promise<any> {
    // FIXME add redirect later
    return res.status(404).send();
  }
}
