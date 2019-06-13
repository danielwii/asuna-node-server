import { join, resolve } from 'path';
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
import { DynamicConfigKeys, DynamicConfigs } from '../config/dynamicConfigs';

export interface IAsunaContextOpts {
  /**
   * default: app
   */
  defaultModulePrefix?: string;
  root: string;
}

export class AsunaContext {
  public static readonly instance = new AsunaContext();

  private opts: IAsunaContextOpts = {
    defaultModulePrefix: 'www',
    root: resolve(__dirname, '../..'),
  };

  public readonly dirname: string;
  public uploadPath: string;

  public imageStorageEngine: IStorageEngine;
  public videoStorageEngine: IStorageEngine;
  public fileStorageEngine: IStorageEngine;

  private constructor() {
    this.dirname = join(__dirname, '../..');

    this.initStorageEngine(`${process.cwd()}/uploads`);
  }

  init(opts: IAsunaContextOpts) {
    if (opts == null) {
      throw new Error('opts must not be empty.');
    }
    this.opts = {
      defaultModulePrefix: opts.defaultModulePrefix || 'www',
      root: opts.root,
    };
  }

  initStorageEngine(uploadPath: string) {
    this.uploadPath = uploadPath;
    const imageStorage = configLoader.loadConfig(ConfigKeys.IMAGE_STORAGE);
    if (imageStorage === StorageMode.QINIU) {
      this.imageStorageEngine = new QiniuStorage(() => QiniuConfigObject.load('image'));
      DynamicConfigs.setup(DynamicConfigKeys.imageStorage, {
        mode: StorageMode.QINIU,
        loader: () => QiniuConfigObject.load('image'),
      });
    } else if (imageStorage === StorageMode.MINIO) {
      this.imageStorageEngine = new MinioStorage(() => MinioConfigObject.load());
      DynamicConfigs.setup(DynamicConfigKeys.imageStorage, {
        mode: StorageMode.MINIO,
        loader: () => MinioConfigObject.load(),
      });
    } else {
      this.imageStorageEngine = new LocalStorage(this.uploadPath);
      DynamicConfigs.setup(DynamicConfigKeys.imageStorage, { mode: StorageMode.LOCAL });
    }

    const videoStorage = configLoader.loadConfig(ConfigKeys.VIDEO_STORAGE);
    if (videoStorage === StorageMode.QINIU) {
      this.videoStorageEngine = new QiniuStorage(() => QiniuConfigObject.load('video'));
    } else if (videoStorage === StorageMode.MINIO) {
      this.videoStorageEngine = new MinioStorage(() => MinioConfigObject.load());
    } else {
      this.videoStorageEngine = new LocalStorage(this.uploadPath, 'videos');
    }

    const fileStorage = configLoader.loadConfig(ConfigKeys.FILE_STORAGE);
    if (fileStorage === StorageMode.QINIU) {
      this.fileStorageEngine = new QiniuStorage(() => QiniuConfigObject.load('file'));
    } else if (fileStorage === StorageMode.MINIO) {
      this.fileStorageEngine = new MinioStorage(() => MinioConfigObject.load());
    } else {
      this.fileStorageEngine = new LocalStorage(this.uploadPath, 'files');
    }
  }

  get defaultModulePrefix() {
    return this.opts.defaultModulePrefix;
  }

  static get isDebugMode() {
    return configLoader.loadConfig(ConfigKeys.DEBUG);
  }
}
