import { Logger } from '@nestjs/common';
import { oneLineTrim } from 'common-tags';
import { Response } from 'express';
import * as fsExtra from 'fs-extra';
import * as _ from 'lodash';
import { join } from 'path';
import * as sharp from 'sharp';
import { ErrorException, r } from '../../common';
import { AsunaContext } from '../context';
import {
  convertFilename,
  FileInfo,
  IStorageEngine,
  SavedFile,
  StorageMode,
  yearMonthStr,
} from './storage.engines';

export class LocalStorage implements IStorageEngine {
  private static readonly logger = new Logger(LocalStorage.name);
  private readonly storagePath: string;
  private readonly bucket: string;

  constructor(storagePath: string, defaultBucket: string = 'default') {
    this.bucket = defaultBucket || 'default';
    this.storagePath = storagePath;
    LocalStorage.logger.log(oneLineTrim`
      [constructor] init default[${this.bucket}] storage path: '${this.storagePath}/${this.bucket}'
    `);
    fsExtra
      .mkdirs(join(this.storagePath, this.bucket))
      .catch(reason => LocalStorage.logger.warn(r(reason)));
  }

  saveEntity(
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
    LocalStorage.logger.log(`file is '${r({ file, dest })}'`);

    fsExtra.moveSync(file.path, dest);
    return Promise.resolve(
      new SavedFile({
        bucket,
        path: dest,
        prefix,
        mimetype: file.mimetype,
        mode: StorageMode.LOCAL,
        filename,
      }),
    );
  }

  getEntity(fileInfo: SavedFile, toPath?: string): Promise<string> {
    throw new Error('Method not implemented.');
  }

  public resolveUrl({ filename, bucket, prefix, thumbnailConfig, jpegConfig }, res: Response) {
    const fullFilePath = join(AsunaContext.instance.uploadPath, bucket, prefix, filename);
    if (!fullFilePath.startsWith(AsunaContext.instance.uploadPath)) {
      throw new Error('filePath must startsWith upload-path');
    }
    LocalStorage.logger.log(r({ filename, prefix, bucket, thumbnailConfig, jpegConfig }));

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
      return res.type(ext).send(fsExtra.createReadStream(outputPath));
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
          `create outputPath image error ${r({ outputPath, err: err.stack, info })}`,
        );
        res.status(404).send(err.message);
      } else {
        res.type(ext).sendFile(outputPath);
      }
    });
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
}
