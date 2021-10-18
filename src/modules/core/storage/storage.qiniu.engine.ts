import { AsunaErrorCode, AsunaException, ErrorException } from '@danielwii/asuna-helper/dist/exceptions';
import { LoggerFactory } from '@danielwii/asuna-helper/dist/logger/factory';
import { r } from '@danielwii/asuna-helper/dist/serializer';

import { classToPlain } from 'class-transformer';
import * as _ from 'lodash';
import { join } from 'path';
import * as qiniu from 'qiniu';

import { convertFilename } from '../../common/helpers';
import { UploaderConfigObject } from '../uploader/config';
import { QiniuConfigObject } from './storage.config';
import { FileInfo, IStorageEngine, ResolverOpts, SavedFile, StorageMode, yearMonthStr } from './storage.engines';

import type { Response } from 'express';

export class QiniuStorage implements IStorageEngine {
  private static readonly logger = LoggerFactory.getLogger(QiniuStorage.name);

  private readonly config = UploaderConfigObject.load();
  private readonly configObject: QiniuConfigObject;

  public constructor(configure: () => QiniuConfigObject) {
    this.configObject = configure();
    QiniuStorage.logger.log(`[constructor] init [${this.configObject.bucket}] with path:${this.configObject.path} ...`);

    if (this.configObject.enable !== true) {
      throw new Error(
        `qiniu must enable when using qiniu storage engine: ${r({ configs: classToPlain(this.configObject) })}`,
      );
    }
    QiniuStorage.logger.log(`[constructor] init ${r({ configs: classToPlain(this.configObject) })}`);
  }

  public saveEntity(
    file: FileInfo,
    opts: { bucket?: string; prefix?: string; region?: string } = {},
  ): Promise<SavedFile> {
    if (!file) {
      throw new ErrorException('QiniuStorage', 'file must not be null.');
    }

    return new Promise<SavedFile>((resolve, reject) => {
      const mac = new qiniu.auth.digest.Mac(this.configObject.accessKey, this.configObject.secretKey);
      const bucket = opts.bucket || this.configObject.path;
      const prefix = opts.prefix || yearMonthStr();
      const filename = convertFilename(file.filename);
      const filenameWithPrefix = join(prefix, filename);
      QiniuStorage.logger.log(`generate key by '${r({ bucket, filenameWithPrefix, self: this.configObject, file })}`);
      const key = join('/', bucket, filenameWithPrefix).slice(1);
      QiniuStorage.logger.log(`upload file to '${this.configObject.bucket}', Key: '${key}' ${r(opts)}`);
      const uploadToken = new qiniu.rs.PutPolicy({ scope: this.configObject.bucket }).uploadToken(mac);

      new qiniu.form_up.FormUploader().putFile(
        uploadToken,
        key,
        file.path,
        new qiniu.form_up.PutExtra(),
        (err, body, info) => {
          if (err) {
            reject(err);
            // throw new AsunaException(AsunaErrorCode.Unprocessable, `upload file '${key}' error`, err);
            // throw new ErrorException('QiniuStorage', `upload file '${key}' error`, err);
          } else {
            QiniuStorage.logger.log(`upload file '${r({ key, /* info, */ body })}'`);
            const resourcePath = this.config.resourcePath;
            const appendPrefix = join('/', this.configObject.path || '').startsWith(resourcePath)
              ? join(bucket)
              : join(resourcePath, bucket);
            resolve(
              new SavedFile({
                prefix,
                path: `${prefix}/${filename}`,
                bucket: this.configObject.bucket,
                mimetype: file.mimetype,
                mode: StorageMode.QINIU,
                filename,
                fullpath: join(appendPrefix, prefix, filename),
              }),
            );
            /*
            if (info.statusCode === 200) {
            } else {
              throw new ErrorException('QiniuStorage', `upload file '${key}' error`, {
                info,
                body,
              });
            }
*/
          }
        },
      );
    });
  }

  public getEntity(fileInfo: SavedFile, toPath?: string): Promise<string> {
    throw new Error('Method not implemented.');
  }

  public listEntities(opts: { bucket?: string; prefix?: string }): Promise<SavedFile[]> {
    throw new Error('Method not implemented.');
  }

  public removeEntities(opts: { bucket?: string; prefix?: string; filename?: string }): Promise<void> {
    throw new Error('Method not implemented.');
  }

  public async resolveUrl(opts: ResolverOpts): Promise<string>;
  public async resolveUrl(opts: ResolverOpts, res: Response): Promise<void>;
  public async resolveUrl(opts: ResolverOpts, res?: Response): Promise<string | void> {
    if (!res) throw new AsunaException(AsunaErrorCode.Unprocessable, 'not implemented for non-res exists.');

    const { filename, bucket, prefix, thumbnailConfig, jpegConfig, query } = opts;
    // 识别七牛的视频处理参数
    const resolvedQuery = _.find(_.keys(query), (key) => key.startsWith('avvod'));
    // const resourcePath = configLoader.loadConfig(ConfigKeys.RESOURCE_PATH, '/uploads');
    // const appendPrefix = this.configObject.path;
    // const appendPrefix = join('/', this.configObject.path || '').startsWith(resourcePath)
    //   ? join(this.configObject.path || '')
    //   : join(resourcePath, this.configObject.path || '');
    const path = `${join('/', bucket, prefix || '', filename)}${resolvedQuery ? `?${resolvedQuery}` : ''}`;
    const resolved = opts.resolver ? await opts.resolver(path) : path;
    // TODO 在非默认 storage 下访问会出现问题
    const url = resolved.startsWith('http') ? resolved : `${this.configObject.domain}${path}`;
    QiniuStorage.logger.log(`resolve url '${url}' by ${r({ bucket, prefix, filename, resolvedQuery, resolved })}`);
    return res.redirect(url);
  }
}
