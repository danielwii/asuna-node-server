import { Response } from 'express';
import * as _ from 'lodash';
import { JpegParam } from '../image/jpeg.pipe';
import { ThumbnailParam } from '../image/thumbnail.pipe';

export enum StorageMode {
  LOCAL = 'local',
  QINIU = 'qiniu',
  MINIO = 'minio',
}

export class SavedFile {
  bucket?: string; // default: 'default'
  region?: string; // default: 'local'
  prefix?: string;
  mode: StorageMode;
  mimetype?: string;
  filename: string;

  constructor({
    bucket,
    region,
    prefix,
    mode,
    mimetype,
    filename,
  }: {
    bucket?: string; // default: 'default'
    region?: string; // default: 'local'
    prefix?: string;
    mode: StorageMode;
    mimetype?: string;
    filename: string;
  }) {
    this.bucket = bucket;
    this.region = region;
    this.prefix = prefix;
    this.mode = mode;
    this.mimetype = mimetype;
    this.filename = filename;
  }
}

export interface IStorageEngine {
  /**
   * 这里会创建一个上传任务，异步执行
   * @param file
   * @param opts
   */
  saveEntity(
    file: { filename: string; path: string; mimetype: string; extension?: string },
    opts: { bucket?: string; prefix?: string; region?: string },
  ): Promise<SavedFile>;

  listEntities(opts: { bucket?: string; prefix?: string }): Promise<SavedFile[]>;

  removeEntities(opts: { bucket?: string; prefix?: string; filename?: string }): Promise<void>;

  /**
   * 如果是远程仓库，该命令应该先下载文件。然后和本地仓库一样，返回文件信息
   * @param fileInfo
   * @param toPath?   保存文件目录的一个可选项，对本地仓库来说，应该直接略过该参数
   */
  getEntity(fileInfo: SavedFile, toPath?: string): Promise<string>;

  /**
   * 返回相应的 url，在包含 res 时直接通过 res 返回相应的信息
   * @param filename
   * @param bucket
   * @param prefix
   * @param thumbnailConfig
   * @param jpegConfig
   * @param resolver 用来解析最终地址的转化器，通常是由于域名是配置在外部，所以这里传入一个 wrapper 方法来包装一下
   * @param res
   */
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
      bucket: string;
      prefix?: string;
      thumbnailConfig?: { opts: ThumbnailParam; param?: string };
      jpegConfig?: { opts: JpegParam; param?: string };
      resolver?: (url: string) => Promise<any>;
    },
    res?: Response,
  ): Promise<any>;
}

export function yearMonthStr() {
  const now = new Date();
  return `${now.getFullYear()}/${now.getMonth() + 1}`;
}

export function convertFilename(filename: string) {
  return filename.replace(/[^\w\._]+/g, '_');
}
