import { oneLineTrim } from 'common-tags';
import { Response } from 'express';
import * as fs from 'fs-extra';
import * as mime from 'mime-types';
import { join } from 'path';
import * as sharp from 'sharp';
import { AsunaErrorCode, AsunaException, convertFilename, ErrorException, r } from '../../common';
import { LoggerFactory } from '../../common/logger';
import { ConfigKeys, configLoader } from '../../config';
import { UploaderConfig } from '../uploader/config';
import { FileInfo, IStorageEngine, ResolverOpts, SavedFile, StorageMode, yearMonthStr } from './storage.engines';

export class LocalStorage implements IStorageEngine {
  private static readonly logger = LoggerFactory.getLogger(LocalStorage.name);

  private readonly storagePath: string;

  private readonly bucket: string;

  constructor(storagePath: string, defaultBucket = 'default') {
    this.bucket = defaultBucket || 'default';
    this.storagePath = storagePath;
    LocalStorage.logger.log(oneLineTrim`
      [constructor] init default[${this.bucket}] storage path: '${this.storagePath}/${this.bucket}'
    `);
    fs.mkdirs(join(this.storagePath, this.bucket)).catch(error => LocalStorage.logger.warn(r(error)));
  }

  saveEntity(file: FileInfo, opts: { bucket?: string; prefix?: string; region?: string } = {}): Promise<SavedFile> {
    if (!file) {
      throw new ErrorException('LocalStorage', 'file must not be null.');
    }
    const bucket = opts.bucket || this.bucket || 'default';
    const prefix = opts.prefix || yearMonthStr();
    const filename = convertFilename(file.filename);
    const dest = join(this.storagePath, bucket, prefix, filename);
    LocalStorage.logger.log(`file is '${r({ file, dest })}'`);

    fs.moveSync(file.path, dest);
    return Promise.resolve(
      new SavedFile({
        bucket,
        path: dest,
        prefix,
        mimetype: file.mimetype,
        mode: StorageMode.LOCAL,
        filename,
        fullpath: join(configLoader.loadConfig(ConfigKeys.RESOURCE_PATH, '/uploads'), bucket, prefix, filename),
      }),
    );
  }

  getEntity(fileInfo: SavedFile, toPath?: string): Promise<string> {
    throw new Error('Method not implemented.');
  }

  listEntities(opts: { bucket?: string; prefix?: string }): Promise<SavedFile[]> {
    // const directory =
    // fs.readdirSync(join(AsunaContext.instance.uploadPath, opts.bucket, opts.prefix));
    // return directory.map(file => new SavedFile());
    throw new Error('not implemented'); // TODO not implemented
  }

  removeEntities(opts: { bucket?: string; prefix?: string; filename?: string }): Promise<void> {
    throw new Error('Method not implemented.');
  }

  resolveUrl(opts: ResolverOpts): Promise<string>;
  resolveUrl(opts: ResolverOpts, res: Response): Promise<void>;
  resolveUrl(opts: ResolverOpts, res?: Response): Promise<string | void> {
    if (!res) throw new AsunaException(AsunaErrorCode.Unprocessable, 'not implemented for non-res exists.');

    const { filename, bucket, prefix, thumbnailConfig, jpegConfig } = opts;
    const fullFilePath = join(UploaderConfig.uploadPath, bucket, prefix || '', filename);
    if (!fullFilePath.startsWith(UploaderConfig.uploadPath)) {
      throw new Error('filePath must startsWith upload-path');
    }

    if (!fs.existsSync(fullFilePath)) {
      throw new AsunaException(AsunaErrorCode.NotFound);
    }

    let type = mime.lookup(filename);
    if (!type) {
      // 无法识别的文件类型，直接返回
      res.contentType('application/octet-stream').sendFile(fullFilePath);
      return;
    }
    const ext = mime.extension(type);
    if (!ext) {
      // 无法识别的文件格式，直接返回
      res.contentType('application/octet-stream').sendFile(fullFilePath);
      return;
    }

    LocalStorage.logger.log(`resolveUrl ${r({ filename, prefix, type, ext, bucket, thumbnailConfig, jpegConfig })}`);

    if (type.startsWith('video/')) {
      LocalStorage.logger.log(`${fullFilePath} with type '${ext}' exists. send to client.`);
      res.type(ext).sendFile(fullFilePath);
      return;
    } else if (type.startsWith('image/')) {
      // const ext = _.last(fullFilePath.split('.'));
      const fullFileDir = fullFilePath.slice(0, -1 - ext.length);
      let outputFilename = 'compressed';
      if (thumbnailConfig.param) {
        outputFilename += `@${thumbnailConfig.param.replace('/', ':')}`;
      }
      if (jpegConfig.param) {
        outputFilename += `@${jpegConfig.param.replace('/', ':')}`;
      }
      const outputPath = `${fullFileDir}/${outputFilename}.${ext}`;

      LocalStorage.logger.log(`check file type '${ext}' for '${outputPath}'`);
      if (!['png', 'jpg', 'jpeg'].includes(ext)) {
        if (fs.existsSync(outputPath)) {
          LocalStorage.logger.log(`${fullFileDir} with type '${ext}' exists. send to client.`);
          res.type(ext).sendFile(fullFilePath);
          return;
        }
        throw new AsunaException(AsunaErrorCode.NotFound);
      }

      LocalStorage.logger.log(`check if '${ext}' file outputPath '${outputPath}' exists`);
      if (fs.existsSync(outputPath)) {
        LocalStorage.logger.log(`${fullFileDir} with type '${ext}' exists. send to client.`);
        res.type(ext).sendFile(outputPath);
        return;
      }

      fs.mkdirpSync(fullFileDir);
      LocalStorage.logger.log(`create outputPath '${outputPath}' for file '${fullFilePath}'`);
      const imageProcess = sharp(fullFilePath);
      if (thumbnailConfig && thumbnailConfig.opts) {
        LocalStorage.logger.verbose(`resize image '${fullFilePath}' by '${r(thumbnailConfig)}'`);
        imageProcess.resize(thumbnailConfig.opts.width, thumbnailConfig.opts.height, {
          fit: thumbnailConfig.opts.fit,
        });
      }
      if (['jpg', 'jpeg'].includes(ext)) {
        imageProcess.jpeg(jpegConfig.opts);
      }
      imageProcess.toFile(outputPath, (err, info) => {
        if (err) {
          LocalStorage.logger.error(`create outputPath image error ${r({ outputPath, err: err.stack, info })}`);
          throw new AsunaException(AsunaErrorCode.NotFound, err.message);
        } else {
          res.type(ext).sendFile(outputPath);
        }
      });
    } else {
      if (fs.existsSync(fullFilePath)) {
        LocalStorage.logger.log(`${fullFilePath} with type '${ext}' exists. send to client.`);
        res.type(ext).sendFile(fullFilePath);
        return;
      }
    }
  }
}
