import { Logger } from '@nestjs/common';
import { join, resolve } from 'path';
import { DynamicConfigKeys, DynamicConfigs } from '../config/dynamicConfigs';
import { renderObject } from '../logger';
import { ConfigKeys, configLoader } from './config.helper';
import {
  IStorageEngine,
  LocalStorage,
  MinioConfigObject,
  MinioStorage,
  QiniuConfigObject,
  QiniuStorage,
  StorageMode,
} from './storage';

const logger = new Logger('AsunaContext');

export interface IAsunaContextOpts {
  /**
   * default: app
   */
  defaultModulePrefix?: string;
  // root: string;
}

export class AsunaContext {
  public static readonly instance = new AsunaContext();

  private opts: IAsunaContextOpts;

  public readonly dirname: string;
  public uploadPath: string;

  public defaultStorageEngine: IStorageEngine;
  public videoStorageEngine: IStorageEngine;
  public fileStorageEngine: IStorageEngine;

  private constructor() {
    logger.log('init ...');
    this.dirname = join(__dirname, '../..');
    this.setup({
      defaultModulePrefix: 'www',
      // root: resolve(__dirname, '../..'),
    });
    this.initStorageEngine(`${process.cwd()}/uploads`);
  }

  setup(opts: Partial<IAsunaContextOpts> = {}) {
    logger.log(`setup ${renderObject(opts)}`);
    this.opts = {
      defaultModulePrefix: opts.defaultModulePrefix || 'www',
      // root: opts.root || resolve(__dirname, '../..'),
    };
  }

  initStorageEngine(uploadPath: string) {
    logger.log(`initStorageEngine ${renderObject({ uploadPath })}`);
    this.uploadPath = uploadPath;
    const imageStorage = configLoader.loadConfig(ConfigKeys.IMAGE_STORAGE);
    if (imageStorage === StorageMode.QINIU) {
      this.defaultStorageEngine = new QiniuStorage(() => QiniuConfigObject.load('image'));
      DynamicConfigs.setup(DynamicConfigKeys.imageStorage, {
        mode: StorageMode.QINIU,
        loader: () => QiniuConfigObject.load('image'),
      });
    } else if (imageStorage === StorageMode.MINIO) {
      this.defaultStorageEngine = new MinioStorage(() => MinioConfigObject.load());
      DynamicConfigs.setup(DynamicConfigKeys.imageStorage, {
        mode: StorageMode.MINIO,
        loader: () => MinioConfigObject.load(),
      });
    } else {
      this.defaultStorageEngine = new LocalStorage(this.uploadPath);
      DynamicConfigs.setup(DynamicConfigKeys.imageStorage, { mode: StorageMode.LOCAL });
    }

    const videoStorage = configLoader.loadConfig(ConfigKeys.VIDEO_STORAGE);
    if (videoStorage === StorageMode.QINIU) {
      this.videoStorageEngine = new QiniuStorage(() => QiniuConfigObject.load('video'));
    } else if (videoStorage === StorageMode.MINIO) {
      this.videoStorageEngine = new MinioStorage(() => MinioConfigObject.load(), {
        defaultBucket: 'videos',
      });
    } else {
      this.videoStorageEngine = new LocalStorage(this.uploadPath, 'videos');
    }

    const fileStorage = configLoader.loadConfig(ConfigKeys.FILE_STORAGE);
    if (fileStorage === StorageMode.QINIU) {
      this.fileStorageEngine = new QiniuStorage(() => QiniuConfigObject.load('file'));
    } else if (fileStorage === StorageMode.MINIO) {
      this.fileStorageEngine = new MinioStorage(() => MinioConfigObject.load(), {
        defaultBucket: 'files',
      });
    } else {
      this.fileStorageEngine = new LocalStorage(this.uploadPath, 'files');
    }
  }

  get defaultModulePrefix() {
    return this.opts.defaultModulePrefix || 'www';
  }

  static get isDebugMode() {
    return configLoader.loadConfig(ConfigKeys.DEBUG);
  }
}
