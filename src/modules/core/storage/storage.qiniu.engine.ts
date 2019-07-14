import { Logger } from '@nestjs/common';
import { classToPlain } from 'class-transformer';
import { join } from 'path';
import * as qiniu from 'qiniu';
import { ErrorException, r } from '../../common';
import { JpegParam } from '../image/jpeg.pipe';
import { ThumbnailParam } from '../image/thumbnail.pipe';
import { QiniuConfigObject } from './storage.config';
import {
  convertFilename,
  FileInfo,
  IStorageEngine,
  SavedFile,
  StorageMode,
  yearMonthStr,
} from './storage.engines';

export class QiniuStorage implements IStorageEngine {
  private static readonly logger = new Logger(QiniuStorage.name);
  // private temp: string;
  private readonly mac: qiniu.auth.digest.Mac;
  constructor(private configLoader: () => QiniuConfigObject) {
    const configObject = configLoader();
    QiniuStorage.logger.log(
      `[constructor] init [${configObject.bucket}] with default prefix:${configObject.prefix} ...`,
    );

    if (configObject.enable !== true) {
      throw new Error(
        `qiniu must enable when using qiniu storage engine: ${r({
          configs: classToPlain(configObject),
        })}`,
      );
    }
    QiniuStorage.logger.log(`[constructor] init ${r({ configs: classToPlain(configObject) })}`);

    // this.temp = fsExtra.mkdtempSync('temp');
    this.mac = new qiniu.auth.digest.Mac(configObject.accessKey, configObject.secretKey);
  }
  public saveEntity(
    file: FileInfo,
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
            QiniuStorage.logger.log(`upload file '${r({ key, info, body })}'`);
            resolve(
              new SavedFile({
                prefix,
                path: `${prefix}/${filename}`,
                bucket: config.bucket,
                mimetype: file.mimetype,
                mode: StorageMode.QINIU,
                filename,
              }),
            );
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

  getEntity(fileInfo: SavedFile, toPath?: string): Promise<string> {
    throw new Error('Method not implemented.');
  }

  listEntities(opts: { bucket?: string; prefix?: string }): Promise<SavedFile[]> {
    throw new Error('Method not implemented.');
  }

  removeEntities(opts: { bucket?: string; prefix?: string; filename?: string }): Promise<void> {
    throw new Error('Method not implemented.');
  }

  public resolveUrl(
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
