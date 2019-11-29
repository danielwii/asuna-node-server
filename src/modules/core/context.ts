import * as fs from 'fs-extra';
import { join } from 'path';
import { r } from '../common';
import { ConfigKeys, configLoader, DynamicConfigKeys, DynamicConfigs } from '../config';
import { LoggerFactory } from '../common/logger';
import {
  IStorageEngine,
  LocalStorage,
  MinioConfigObject,
  MinioStorage,
  QiniuConfigObject,
  QiniuStorage,
  StorageMode,
} from './storage';

const logger = LoggerFactory.getLogger('AsunaContext');

export interface IAsunaContextOpts {
  /**
   * default: app
   */
  defaultModulePrefix?: string;
  // root: string;
}

export type StorageEngineMode = 'chunks';

export class AsunaContext {
  public static readonly instance = new AsunaContext();

  public opts: IAsunaContextOpts;

  public readonly dirname: string;

  public uploadPath: string;

  public tempPath: string;

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

    if (configLoader.loadBoolConfig(ConfigKeys.UPLOADER_ENABLE, true))
      this.initStorageEngine(`${process.cwd()}/uploads`);
    this.tempPath = `${process.cwd()}/temp`;
    fs.mkdirs(join(this.tempPath)).catch(error => logger.warn(r(error)));
  }

  setup(opts: Partial<IAsunaContextOpts> = {}) {
    logger.log(`setup ${r(opts)}`);
    this.opts = {
      defaultModulePrefix: opts.defaultModulePrefix || 'www',
      // root: opts.root,
      // root: opts.root || resolve(__dirname, '../..'),
    };
  }

  initStorageEngine(uploadPath: string): void {
    logger.log(`initStorageEngine ${r({ uploadPath })}`);
    this.uploadPath = uploadPath;
    const imageStorage = configLoader.loadConfig(ConfigKeys.IMAGES_STORAGE);
    if (imageStorage === StorageMode.QINIU) {
      this.defaultStorageEngine = new QiniuStorage(() => QiniuConfigObject.loadOr('images'));
      // TODO dynamic configs not implemented yet
      DynamicConfigs.setup(DynamicConfigKeys.imageStorage, {
        mode: StorageMode.QINIU,
        loader: () => QiniuConfigObject.loadOr('images'),
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

    const videoStorage = configLoader.loadConfig(ConfigKeys.VIDEOS_STORAGE);
    if (videoStorage === StorageMode.QINIU) {
      this.videoStorageEngine = new QiniuStorage(() => QiniuConfigObject.loadOr('videos'));
    } else if (videoStorage === StorageMode.MINIO) {
      this.videoStorageEngine = new MinioStorage(() => MinioConfigObject.load(), {
        defaultBucket: 'videos',
      });
    } else {
      this.videoStorageEngine = new LocalStorage(this.uploadPath, 'videos');
    }

    const fileStorage = configLoader.loadConfig(ConfigKeys.FILES_STORAGE);
    if (fileStorage === StorageMode.QINIU) {
      this.fileStorageEngine = new QiniuStorage(() => QiniuConfigObject.loadOr('files'));
    } else if (fileStorage === StorageMode.MINIO) {
      this.fileStorageEngine = new MinioStorage(() => MinioConfigObject.load(), {
        defaultBucket: 'files',
      });
    } else {
      this.fileStorageEngine = new LocalStorage(this.uploadPath, 'files');
    }

    this.localStorageEngine = new LocalStorage(this.uploadPath, 'local');

    const chunkStorage = configLoader.loadConfig(ConfigKeys.CHUNKS_STORAGE);
    if (chunkStorage === StorageMode.QINIU) {
      this.chunkStorageEngine = new QiniuStorage(() => QiniuConfigObject.loadOr('chunks'));
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

  get defaultModulePrefix(): string {
    return this.opts.defaultModulePrefix || 'www';
  }

  static get isDebugMode(): boolean {
    return configLoader.loadConfig(ConfigKeys.DEBUG);
  }
}
