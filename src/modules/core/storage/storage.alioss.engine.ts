import { Logger } from '@nestjs/common';

import { AsunaErrorCode, AsunaException, ErrorException } from '@danielwii/asuna-helper/dist/exceptions';
import { r } from '@danielwii/asuna-helper/dist/serializer';

import OSS from 'ali-oss';
import { instanceToPlain } from 'class-transformer';
import _ from 'lodash';
import { join } from 'path';

import { convertFilename } from '../../common/helpers';
import { resolveModule } from '@danielwii/asuna-helper/dist/logger/factory';
import { UploaderConfigObject } from '../uploader/config';
import { AliossConfigObject } from './storage.config';
import { FileInfo, IStorageEngine, ResolverOpts, SavedFile, StorageMode, yearMonthStr } from './storage.engines';

import type { Response } from 'express';

export class AliossStorage implements IStorageEngine {
  private static readonly logger = new Logger(resolveModule(__filename, AliossStorage.name));

  private readonly config = UploaderConfigObject.load();
  private readonly configObject: AliossConfigObject;

  public constructor(configure: () => AliossConfigObject) {
    this.configObject = configure();
    AliossStorage.logger.log(
      `[constructor] init [${this.configObject.defaultBucket}] with region:${this.configObject.region} ...`,
    );

    if (this.configObject.enable !== true) {
      throw new Error(
        `alioss must enable when using alioss storage engine: ${r({ configs: instanceToPlain(this.configObject) })}`,
      );
    }
    AliossStorage.logger.log(`[constructor] init ${r({ configs: instanceToPlain(this.configObject) })}`);
  }

  public get client(): OSS {
    return new OSS({
      region: this.configObject.region,
      bucket: this.configObject.defaultBucket,
      accessKeyId: this.configObject.accessKey,
      accessKeySecret: this.configObject.secretKey,
    });
  }

  public async saveEntity(
    file: FileInfo,
    opts: { bucket?: string; prefix?: string; region?: string } = {},
  ): Promise<SavedFile> {
    if (!file) {
      throw new ErrorException('AliossStorage', 'file must not be null.');
    }

    const bucket = opts.bucket || this.configObject.defaultBucket;
    const prefix = opts.prefix || yearMonthStr();
    const filename = convertFilename(file.filename);
    const filenameWithPrefix = join(prefix, filename);
    AliossStorage.logger.log(`generate key by '${r({ bucket, filenameWithPrefix, self: this.configObject, file })}`);
    const key = join('/', bucket, filenameWithPrefix).slice(1);
    AliossStorage.logger.log(`upload file to '${this.configObject.defaultBucket}', Key: '${key}' ${r(opts)}`);

    return this.client.put(key, file.path).then((result) => {
      AliossStorage.logger.log(`upload file '${r({ key, /* info, */ result })}'`);
      const resourcePath = this.config.resourcePath;
      const appendPrefix = join('/', this.configObject.defaultBucket || '').startsWith(resourcePath)
        ? join(bucket)
        : join(resourcePath, bucket);
      return new SavedFile({
        prefix,
        path: `${prefix}/${filename}`,
        bucket: this.configObject.defaultBucket,
        mimetype: file.mimetype,
        mode: StorageMode.ALIOSS,
        filename,
        fullpath: join(appendPrefix, prefix, filename),
      });
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
    const url = resolved.startsWith('http') ? resolved : `${this.configObject.defaultBucket}${path}`;
    AliossStorage.logger.log(`resolve url '${url}' by ${r({ bucket, prefix, filename, resolvedQuery, resolved })}`);
    return res.redirect(url);
  }
}
