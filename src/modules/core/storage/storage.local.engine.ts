import { LoggerFactory } from '@danielwii/asuna-helper/dist/logger';
import { r } from '@danielwii/asuna-helper/dist/serializer';

import { oneLineTrim } from 'common-tags';
import { Response } from 'express';
import * as fs from 'fs-extra';
import * as mime from 'mime-types';
import { extname, join } from 'path';
import sharp from 'sharp';

import { AsunaErrorCode, AsunaException, ErrorException } from '@danielwii/asuna-helper/dist/exceptions';
import { convertFilename } from '../../common/helpers';
import { Global } from '../global';
import { UploaderConfigObject } from '../uploader/config';
import { FileInfo, IStorageEngine, ResolverOpts, SavedFile, StorageMode, yearMonthStr } from './storage.engines';

const logger = LoggerFactory.getLogger('LocalStorage');

export class LocalStorage implements IStorageEngine {
  private readonly storagePath: string;

  private readonly bucket: string;
  private readonly config = UploaderConfigObject.load();

  public constructor(storagePath: string, defaultBucket = 'default') {
    this.bucket = defaultBucket || 'default';
    this.storagePath = storagePath;
    logger.log(oneLineTrim`
      [constructor] init default[${this.bucket}] storage path: '${this.storagePath}/${this.bucket}'
    `);
    fs.mkdirs(join(this.storagePath, this.bucket)).catch((error) => logger.warn(r(error)));
  }

  public saveEntity(
    file: FileInfo,
    opts: { bucket?: string; prefix?: string; region?: string } = {},
  ): Promise<SavedFile> {
    if (!file) {
      throw new ErrorException('LocalStorage', 'file must not be null.');
    }
    const bucket = opts.bucket || this.bucket || 'default';
    const prefix = opts.prefix || yearMonthStr();
    const filename = convertFilename(file.filename);
    const dest = join(this.storagePath, bucket, prefix, filename);
    logger.log(`file is '${r({ file, dest })}'`);

    if (fs.existsSync(dest)) fs.removeSync(dest);
    fs.moveSync(file.path, dest);
    return Promise.resolve(
      new SavedFile({
        bucket,
        path: filename,
        prefix,
        mimetype: file.mimetype,
        mode: StorageMode.LOCAL,
        filename,
        fullpath: join(this.config.resourcePath, bucket, prefix, filename),
      }),
    );
  }

  public async getEntity(fileInfo: SavedFile, toPath?: string): Promise<string> {
    logger.debug(`getEntity ${r({ fileInfo, toPath })}`);
    return join(Global.uploadPath, fileInfo.bucket ?? '', fileInfo.prefix ?? '', fileInfo.path);
  }

  public async listEntities(opts: { bucket?: string; prefix?: string }): Promise<SavedFile[]> {
    const path = join(Global.uploadPath, opts.bucket ?? '', opts.prefix ?? '');
    const directory = fs.readdirSync(path);
    logger.debug(`listEntities ${r({ opts, directory })}`);
    return directory.map((filename) => {
      const fileInfo = new FileInfo({ filename, path: join(path, filename) });
      return new SavedFile({
        bucket: opts.bucket,
        path: join(fileInfo.filename),
        prefix: opts.prefix,
        mimetype: fileInfo.mimetype,
        mode: StorageMode.LOCAL,
        filename,
        fullpath: join(this.config.resourcePath, opts.bucket ?? '', opts.prefix ?? '', filename),
      });
    });
  }

  public removeEntities(opts: { bucket?: string; prefix?: string; filename?: string }): Promise<void> {
    logger.debug(`removeEntities ${r(opts)}`);
    throw new Error('Method not implemented.');
  }

  public async resolveUrl(opts: ResolverOpts): Promise<string>;
  public async resolveUrl(opts: ResolverOpts, res: Response): Promise<void>;
  public async resolveUrl(opts: ResolverOpts, res?: Response): Promise<string | void> {
    if (!res) throw new AsunaException(AsunaErrorCode.Unprocessable, 'not implemented for non-res exists.');

    const { filename, bucket, prefix, thumbnailConfig, jpegConfig } = opts;
    const fullFilePath = join(UploaderConfigObject.uploadPath, bucket, prefix || '', filename);
    if (!fullFilePath.startsWith(UploaderConfigObject.uploadPath)) {
      throw new Error('filePath must startsWith upload-path');
    }

    if (!fs.existsSync(fullFilePath)) {
      throw new AsunaException(AsunaErrorCode.NotFound);
    }

    const fileExt = extname(filename);
    const type = mime.lookup(filename);
    if (!type) {
      // 无法识别的文件类型，直接返回
      res.contentType('application/octet-stream').sendFile(fullFilePath);
      return;
    }
    const ext = thumbnailConfig.opts.format ?? mime.extension(type);
    if (!ext) {
      // 无法识别的文件格式，直接返回
      res.contentType('application/octet-stream').sendFile(fullFilePath);
      return;
    }

    logger.log(`resolveUrl ${r({ filename, prefix, type, ext, bucket, thumbnailConfig, jpegConfig })}`);

    if (type.startsWith('video/')) {
      logger.log(`${fullFilePath} with type '${ext}' exists. send to client.`);
      res.type(ext).sendFile(fullFilePath);
    } else if (type.startsWith('image/')) {
      // const ext = _.last(fullFilePath.split('.'));
      const fullFileDir = fullFilePath.slice(0, -fileExt.length);
      let outputFilename = 'compressed';
      if (thumbnailConfig.param) {
        outputFilename += `@${thumbnailConfig.param.replace('/', ':')}`;
      }
      if (jpegConfig.param) {
        outputFilename += `@${jpegConfig.param.replace('/', ':')}`;
      }
      const outputPath = thumbnailConfig.opts.format
        ? `${fullFileDir}/${outputFilename}`
        : `${fullFileDir}/${outputFilename}.${ext}`;

      logger.log(`resolve file ${r({ fullFilePath, fullFileDir, outputFilename, fileExt, ext, outputPath })}`);

      logger.log(`check file type '${ext}' for '${outputPath}'`);
      if (!['png', 'jpg', 'jpeg', 'webp'].includes(ext)) {
        if (fs.existsSync(outputPath)) {
          logger.log(`${fullFileDir} with type '${ext}' exists. send to client.`);
          res.type(ext).sendFile(fullFilePath);
          return;
        }
        throw new AsunaException(AsunaErrorCode.NotFound);
      }

      logger.log(`check if '${ext}' file outputPath '${outputPath}' exists`);
      if (fs.existsSync(outputPath)) {
        logger.log(`${fullFileDir} with type '${ext}' exists. send to client.`);
        res.type(ext).sendFile(outputPath);
        return;
      }

      fs.mkdirpSync(fullFileDir);
      logger.log(`create outputPath '${outputPath}' for file '${fullFilePath}'`);
      const imageProcess = sharp(fullFilePath);
      if (thumbnailConfig.opts) {
        logger.debug(`resize image '${fullFilePath}' by '${r(thumbnailConfig)}'`);
        imageProcess.resize(thumbnailConfig.opts.width, thumbnailConfig.opts.height, { fit: thumbnailConfig.opts.fit });
      }

      if (ext !== 'webp') {
        imageProcess.webp();
      } else if (['jpg', 'jpeg'].includes(ext)) {
        imageProcess.jpeg(jpegConfig.opts);
      }

      imageProcess.toFile(outputPath, (err, info) => {
        if (err) {
          logger.error(`create outputPath image error ${r({ outputPath, err: err.stack, info })}`);
          throw new AsunaException(AsunaErrorCode.NotFound, err.message);
        } else {
          // logger.log(`convert file ${r(info)}`);
          res.type(ext).sendFile(outputPath);
        }
      });
    } else if (fs.existsSync(fullFilePath)) {
      logger.log(`${fullFilePath} with type '${ext}' exists. send to client.`);
      res.type(ext).sendFile(fullFilePath);
    }
  }
}
