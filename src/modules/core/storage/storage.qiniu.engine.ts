import { classToPlain } from 'class-transformer';
import { Response } from 'express';
import * as _ from 'lodash';
import { join } from 'path';
import * as qiniu from 'qiniu';
import { AsunaErrorCode, AsunaException, convertFilename, ErrorException, r } from '../../common';
import { LoggerFactory } from '../../common/logger';
import { ConfigKeys, configLoader } from '../../config';
import { QiniuConfigObject } from './storage.config';
import { FileInfo, IStorageEngine, ResolverOpts, SavedFile, StorageMode, yearMonthStr } from './storage.engines';

export class QiniuStorage implements IStorageEngine {
  private static readonly logger = LoggerFactory.getLogger(QiniuStorage.name);

  // private temp: string;
  private readonly mac: qiniu.auth.digest.Mac;

  private readonly configObject: QiniuConfigObject;

  constructor(configure: () => QiniuConfigObject) {
    this.configObject = configure();
    QiniuStorage.logger.log(`[constructor] init [${this.configObject.bucket}] with path:${this.configObject.path} ...`);

    if (this.configObject.enable !== true) {
      throw new Error(
        `qiniu must enable when using qiniu storage engine: ${r({
          configs: classToPlain(this.configObject),
        })}`,
      );
    }
    QiniuStorage.logger.log(`[constructor] init ${r({ configs: classToPlain(this.configObject) })}`);

    // this.temp = fs.mkdtempSync('temp');
    this.mac = new qiniu.auth.digest.Mac(this.configObject.accessKey, this.configObject.secretKey);
  }

  public saveEntity(
    file: FileInfo,
    opts: { bucket?: string; prefix?: string; region?: string } = {},
  ): Promise<SavedFile> {
    if (!file) {
      throw new ErrorException('QiniuStorage', 'file must not be null.');
    }

    return new Promise<SavedFile>((resolve, reject) => {
      const bucket = opts.bucket || this.configObject.path;
      const prefix = opts.prefix || yearMonthStr();
      const filename = convertFilename(file.filename);
      const filenameWithPrefix = join(prefix, filename);
      const key = join('/', bucket, filenameWithPrefix).slice(1);
      QiniuStorage.logger.log(`upload file to '${this.configObject.bucket}', Key: '${key}' ${r(opts)}`);
      const uploadToken = new qiniu.rs.PutPolicy({ scope: this.configObject.bucket }).uploadToken(this.mac);

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
            const resourcePath = configLoader.loadConfig(ConfigKeys.RESOURCE_PATH, '/uploads');
            const appendPrefix = join('/', this.configObject.path || '').startsWith(resourcePath)
              ? join(this.configObject.path || '')
              : join(resourcePath, this.configObject.path || '');
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

  getEntity(fileInfo: SavedFile, toPath?: string): Promise<string> {
    throw new Error('Method not implemented.');
  }

  listEntities(opts: { bucket?: string; prefix?: string }): Promise<SavedFile[]> {
    throw new Error('Method not implemented.');
  }

  removeEntities(opts: { bucket?: string; prefix?: string; filename?: string }): Promise<void> {
    throw new Error('Method not implemented.');
  }

  resolveUrl(opts: ResolverOpts): Promise<string>;
  resolveUrl(opts: ResolverOpts, res: Response): Promise<void>;
  async resolveUrl(opts: ResolverOpts, res?: Response): Promise<string | void> {
    if (!res) throw new AsunaException(AsunaErrorCode.Unprocessable, 'not implemented for non-res exists.');

    const { filename, bucket, prefix, thumbnailConfig, jpegConfig, query } = opts;
    // 识别七牛的视频处理参数
    const resolvedQuery = _.find(_.keys(query), key => key.startsWith('avvod'));
    // const resourcePath = configLoader.loadConfig(ConfigKeys.RESOURCE_PATH, '/uploads');
    // const appendPrefix = this.configObject.path;
    // const appendPrefix = join('/', this.configObject.path || '').startsWith(resourcePath)
    //   ? join(this.configObject.path || '')
    //   : join(resourcePath, this.configObject.path || '');
    const path = `${join('/', bucket, prefix || '', filename)}?${resolvedQuery}`;
    // TODO 在非默认 storage 下访问会出现问题
    const url = `${this.configObject.domain}${path}`;
    QiniuStorage.logger.log(`resolve url '${url}' by ${r({ bucket, prefix, filename, resolvedQuery })}`);
    return res.redirect(url);
  }
}
