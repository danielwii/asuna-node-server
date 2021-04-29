import { plainToClass, Transform } from 'class-transformer';
import { IsString } from 'class-validator';
import _ from 'lodash';
import * as mime from 'mime-types';

import type { Response } from 'express';
import type { JpegPipeOptions } from '../image/jpeg.pipe';
import type { ThumbnailPipeOptions } from '../image/thumbnail.pipe';

export enum StorageMode {
  LOCAL = 'local',
  QINIU = 'qiniu',
  MINIO = 'minio',
  ALIOSS = 'alioss',
}

export class FileInfo {
  @IsString()
  @Transform(({ value }) => _.trim(value))
  filename: string;

  @IsString()
  @Transform(({ value }) => _.trim(value))
  path: string;

  @IsString()
  @Transform(({ value }) => (value ? _.trim(value) : undefined))
  mimetype?: string;

  @IsString()
  @Transform(({ value }) => (value ? _.trim(value) : undefined))
  extension?: string;

  constructor(o: FileInfo) {
    if (_.isNil(o)) {
      return;
    }

    Object.assign(this, plainToClass(FileInfo, o, { enableImplicitConversion: true }));
    this.mimetype = o.mimetype || mime.lookup(o.filename) || 'application/octet-stream';
    this.extension = o.extension || mime.extension(this.mimetype) || 'bin';
  }
}

export class SavedFile extends FileInfo {
  readonly bucket: string;

  // default: 'default'
  readonly region?: string;

  // default: 'local'
  readonly prefix: string;

  readonly size?: number;

  readonly mode: StorageMode;

  // 用于访问的资源地址
  readonly fullpath: string;

  constructor(o: SavedFile) {
    super(o);
    Object.assign(this, plainToClass(SavedFile, o, { enableImplicitConversion: true }));
  }
}

export interface ResolverOpts {
  filename: string;
  bucket: string;
  prefix?: string;
  query?: object;
  thumbnailConfig?: ThumbnailPipeOptions;
  jpegConfig?: JpegPipeOptions;
  // 用来解析最终地址的转化器，通常是由于域名是配置在外部，所以这里传入一个 wrapper 方法来包装一下
  resolver?: (url: string) => Promise<string>;
}

export interface IStorageEngine {
  /**
   * 这里会创建一个上传任务，异步执行
   * @param file
   * @param opts
   */
  saveEntity: (file: FileInfo, opts: { bucket?: string; prefix?: string; region?: string }) => Promise<SavedFile>;

  listEntities: (opts: { bucket?: string; prefix?: string }) => Promise<SavedFile[]>;

  removeEntities: (opts: { bucket?: string; prefix?: string; filename?: string }) => Promise<void>;

  /**
   * 如果是远程仓库，该命令应该先下载文件。然后和本地仓库一样，返回文件信息
   * @param fileInfo
   * @param toPath?   保存文件目录的一个可选项，对本地仓库来说，应该直接略过该参数
   */
  getEntity: (fileInfo: SavedFile, toPath?: string) => Promise<string>;

  /**
   * 返回相应的 url，在包含 res 时直接通过 res 返回相应的信息
   * TODO need redesign
   */
  resolveUrl: ((opts: ResolverOpts) => Promise<string>) & ((opts: ResolverOpts, res: Response) => Promise<void>);
}

export function yearMonthStr(): string {
  const now = new Date();
  return `${now.getFullYear()}/${now.getMonth() + 1}`;
}
