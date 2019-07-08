import { Logger } from '@nestjs/common';
import { join } from 'path';
import { r } from '../common';
import { DynamicConfigKeys, DynamicConfigs } from '../config/dynamicConfigs';
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
  public localStorageEngine: IStorageEngine;
  public chunkStorageEngine: IStorageEngine;

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
    logger.log(`setup ${r(opts)}`);
    this.opts = {
      defaultModulePrefix: opts.defaultModulePrefix || 'www',
      // root: opts.root || resolve(__dirname, '../..'),
    };
  }

  initStorageEngine(uploadPath: string) {
    logger.log(`initStorageEngine ${r({ uploadPath })}`);
    this.uploadPath = uploadPath;
    const imageStorage = configLoader.loadConfig(ConfigKeys.IMAGE_STORAGE);
    if (imageStorage === StorageMode.QINIU) {
      this.defaultStorageEngine = new QiniuStorage(() => QiniuConfigObject.load('images'));
      // TODO dynamic configs not implemented yet
      DynamicConfigs.setup(DynamicConfigKeys.imageStorage, {
        mode: StorageMode.QINIU,
        loader: () => QiniuConfigObject.load('images'),
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
      this.videoStorageEngine = new QiniuStorage(() => QiniuConfigObject.load('videos'));
    } else if (videoStorage === StorageMode.MINIO) {
      this.videoStorageEngine = new MinioStorage(() => MinioConfigObject.load(), {
        defaultBucket: 'videos',
      });
    } else {
      this.videoStorageEngine = new LocalStorage(this.uploadPath, 'videos');
    }

    const fileStorage = configLoader.loadConfig(ConfigKeys.FILE_STORAGE);
    if (fileStorage === StorageMode.QINIU) {
      this.fileStorageEngine = new QiniuStorage(() => QiniuConfigObject.load('files'));
    } else if (fileStorage === StorageMode.MINIO) {
      this.fileStorageEngine = new MinioStorage(() => MinioConfigObject.load(), {
        defaultBucket: 'files',
      });
    } else {
      this.fileStorageEngine = new LocalStorage(this.uploadPath, 'files');
    }

    this.localStorageEngine = new LocalStorage(this.uploadPath, 'local');

    const chunkStorage = configLoader.loadConfig(ConfigKeys.CHUNK_STORAGE);
    if (chunkStorage === StorageMode.QINIU) {
      this.chunkStorageEngine = new QiniuStorage(() => QiniuConfigObject.load('chunks'));
    } else if (chunkStorage === StorageMode.MINIO) {
      this.chunkStorageEngine = new MinioStorage(() => MinioConfigObject.load(), {
        defaultBucket: 'chunks',
      });
    } else {
      this.chunkStorageEngine = new LocalStorage(this.uploadPath, 'chunks');
    }
  }

  getFilePath(fullpath: string): string {
    return join(this.uploadPath, '../', fullpath);
  }

  get defaultModulePrefix() {
    return this.opts.defaultModulePrefix || 'www';
  }

  static get isDebugMode() {
    return configLoader.loadConfig(ConfigKeys.DEBUG);
  }
}
