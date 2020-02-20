import { oneLineTrim } from 'common-tags';
import { Response } from 'express';
import * as fs from 'fs-extra';
import * as mime from 'mime-types';
import { join } from 'path';
import * as sharp from 'sharp';
import { AsunaErrorCode, AsunaException, convertFilename, ErrorException, r } from '../../common';
import { LoggerFactory } from '../../common/logger';
import { ConfigKeys, configLoader } from '../../config';
import { AsunaContext } from '../context';
import { UploaderConfig } from '../uploader/config';
import { FileInfo, IStorageEngine, ResolverOpts, SavedFile, StorageMode, yearMonthStr } from './storage.engines';

const logger = LoggerFactory.getLogger('LocalStorage');

export class LocalStorage implements IStorageEngine {
  private readonly storagePath: string;

  private readonly bucket: string;

  constructor(storagePath: string, defaultBucket = 'default') {
    this.bucket = defaultBucket || 'default';
    this.storagePath = storagePath;
    logger.log(oneLineTrim`
      [constructor] init default[${this.bucket}] storage path: '${this.storagePath}/${this.bucket}'
    `);
    fs.mkdirs(join(this.storagePath, this.bucket)).catch(error => logger.warn(r(error)));
  }

  saveEntity(file: FileInfo, opts: { bucket?: string; prefix?: string; region?: string } = {}): Promise<SavedFile> {
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
        path: dest,
        prefix,
        mimetype: file.mimetype,
        mode: StorageMode.LOCAL,
        filename,
        fullpath: join(configLoader.loadConfig(ConfigKeys.RESOURCE_PATH, '/uploads'), bucket, prefix, filename),
      }),
    );
  }

  async getEntity(fileInfo: SavedFile, toPath?: string): Promise<string> {
    logger.verbose(`getEntity ${r({ fileInfo, toPath })}`);
    return join(AsunaContext.instance.uploadPath, fileInfo.bucket ?? '', fileInfo.prefix ?? '', fileInfo.path);
  }

  async listEntities(opts: { bucket?: string; prefix?: string }): Promise<SavedFile[]> {
    const path = join(AsunaContext.instance.uploadPath, opts.bucket ?? '', opts.prefix ?? '');
    const directory = fs.readdirSync(path);
    logger.verbose(`listEntities ${r({ opts, directory })}`);
    return directory.map(filename => {
      const fileInfo = new FileInfo({ filename, path: join(path, filename) });
      return new SavedFile({
        bucket: opts.bucket,
        path: join(fileInfo.filename),
        prefix: opts.prefix,
        mimetype: fileInfo.mimetype,
        mode: StorageMode.LOCAL,
        filename,
        fullpath: join(
          configLoader.loadConfig(ConfigKeys.RESOURCE_PATH, '/uploads'),
          opts.bucket ?? '',
          opts.prefix ?? '',
          filename,
        ),
      });
    });
  }

  removeEntities(opts: { bucket?: string; prefix?: string; filename?: string }): Promise<void> {
    logger.verbose(`removeEntities ${r(opts)}`);
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

    const type = mime.lookup(filename);
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

    logger.log(`resolveUrl ${r({ filename, prefix, type, ext, bucket, thumbnailConfig, jpegConfig })}`);

    if (type.startsWith('video/')) {
      logger.log(`${fullFilePath} with type '${ext}' exists. send to client.`);
      res.type(ext).sendFile(fullFilePath);
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

      logger.log(`check file type '${ext}' for '${outputPath}'`);
      if (!['png', 'jpg', 'jpeg'].includes(ext)) {
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
        logger.verbose(`resize image '${fullFilePath}' by '${r(thumbnailConfig)}'`);
        imageProcess.resize(thumbnailConfig.opts.width, thumbnailConfig.opts.height, {
          fit: thumbnailConfig.opts.fit,
        });
      }
      if (['jpg', 'jpeg'].includes(ext)) {
        imageProcess.jpeg(jpegConfig.opts);
      }
      imageProcess.toFile(outputPath, (err, info) => {
        if (err) {
          logger.error(`create outputPath image error ${r({ outputPath, err: err.stack, info })}`);
          throw new AsunaException(AsunaErrorCode.NotFound, err.message);
        } else {
          res.type(ext).sendFile(outputPath);
        }
      });
    } else if (fs.existsSync(fullFilePath)) {
      logger.log(`${fullFilePath} with type '${ext}' exists. send to client.`);
      res.type(ext).sendFile(fullFilePath);
    }
  }
}
