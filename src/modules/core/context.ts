import { ConfigKeys } from '@danielwii/asuna-helper/dist/config';
import { LoggerFactory } from '@danielwii/asuna-helper/dist/logger';
import { r } from '@danielwii/asuna-helper/dist/serializer';

import * as fs from 'fs-extra';
import _ from 'lodash';
import { join } from 'path';

import { configLoader } from '../config';
import { Global } from './global';
import {
  AliossConfigObject,
  IStorageEngine,
  LocalStorage,
  MinioConfigObject,
  MinioStorage,
  QiniuConfigObject,
  QiniuStorage,
  StorageMode,
} from './storage';
import { AliossStorage } from './storage/storage.alioss.engine';
import { UploaderConfigObject } from './uploader/config';

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
  private readonly config = UploaderConfigObject.load();

  public static instance: AsunaContext;

  public opts: IAsunaContextOpts;
  public readonly dirname: string;
  // public uploadPath: string;
  // public tempPath: string;

  public defaultStorageEngine: IStorageEngine;
  /**
   * @see AsunaContext.defaultStorageEngine
   * @deprecated
   */
  public videosStorageEngine: IStorageEngine;
  /**
   * @see AsunaContext.defaultStorageEngine
   * @deprecated
   */
  public filesStorageEngine: IStorageEngine;

  public chunksStorageEngine: IStorageEngine;
  public localStorageEngine: IStorageEngine;

  private constructor() {
    logger.log('init ...');
    this.dirname = join(__dirname, '../..');
    this.setup({
      defaultModulePrefix: 'www',
      // root: resolve(__dirname, '../..'),
    });

    if (this.config.enable) this.initStorageEngine(`${process.cwd()}/uploads`);
    // this.tempPath = `${process.cwd()}/temp`;
    fs.mkdirs(join(Global.tempPath)).catch((error) => logger.warn(r(error)));
  }

  public static async init() {
    if (!this.instance) this.instance = new AsunaContext();
  }

  public setup(opts: Partial<IAsunaContextOpts> = {}): void {
    logger.log(`setup ${r(opts)}`);
    this.opts = {
      defaultModulePrefix: opts.defaultModulePrefix || 'www',
      // root: opts.root,
      // root: opts.root || resolve(__dirname, '../..'),
    };
  }

  public getStorageEngine = _.memoize(
    (bucket: string): IStorageEngine => {
      const KEY = `${bucket.toUpperCase()}_STORAGE`;
      const storageType = configLoader.loadConfig(KEY);
      logger.debug(`getStorageEngine by ${bucket}, ${KEY} : ${storageType}, fallback is default`);
      if (storageType === StorageMode.QINIU) {
        return new QiniuStorage(() => QiniuConfigObject.loadOr(bucket));
      }
      if (storageType === StorageMode.MINIO) {
        return new MinioStorage(() => MinioConfigObject.load(), { defaultBucket: bucket });
      }
      return this.defaultStorageEngine;
    },
  );

  public initStorageEngine(uploadPath: string): void {
    UploaderConfigObject.uploadPath = uploadPath;
    Global.uploadPath = uploadPath;

    const defaultStorage = configLoader.loadConfig(ConfigKeys.STORAGE_DEFAULT);
    logger.log(`initStorageEngine ${r({ uploadPath, defaultStorage })}`);

    if (defaultStorage && !_.values<string>(StorageMode).includes(defaultStorage)) {
      throw new Error(`${defaultStorage} engine not support!`);
    }

    if (defaultStorage === StorageMode.QINIU) {
      this.defaultStorageEngine = new QiniuStorage(() => QiniuConfigObject.loadOr());
    } else if (defaultStorage === StorageMode.MINIO) {
      this.defaultStorageEngine = new MinioStorage(() => MinioConfigObject.load());
    } else if (defaultStorage === StorageMode.ALIOSS) {
      this.defaultStorageEngine = new AliossStorage(() => AliossConfigObject.load());
    } else {
      this.defaultStorageEngine = new LocalStorage(Global.uploadPath);
    }

    /*
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
      this.defaultStorageEngine = new LocalStorage(Global.uploadPath);
      DynamicConfigs.setup(DynamicConfigKeys.imageStorage, { mode: StorageMode.LOCAL });
    }
*/

    const videoStorage = configLoader.loadConfig(ConfigKeys.VIDEOS_STORAGE);
    if (videoStorage === StorageMode.QINIU) {
      this.videosStorageEngine = new QiniuStorage(() => QiniuConfigObject.loadOr('videos'));
    } else if (videoStorage === StorageMode.MINIO) {
      this.videosStorageEngine = new MinioStorage(() => MinioConfigObject.load(), {
        defaultBucket: 'videos',
      });
    } else {
      this.videosStorageEngine = new LocalStorage(Global.uploadPath, 'videos');
    }

    const fileStorage = configLoader.loadConfig(ConfigKeys.FILES_STORAGE);
    if (fileStorage === StorageMode.QINIU) {
      this.filesStorageEngine = new QiniuStorage(() => QiniuConfigObject.loadOr('files'));
    } else if (fileStorage === StorageMode.MINIO) {
      this.filesStorageEngine = new MinioStorage(() => MinioConfigObject.load(), {
        defaultBucket: 'files',
      });
    } else {
      this.filesStorageEngine = new LocalStorage(Global.uploadPath, 'files');
    }

    this.localStorageEngine = new LocalStorage(Global.uploadPath, 'local');

    const chunkStorage = configLoader.loadConfig(ConfigKeys.CHUNKS_STORAGE);
    if (chunkStorage === StorageMode.QINIU) {
      this.chunksStorageEngine = new QiniuStorage(() => QiniuConfigObject.loadOr('chunks'));
    } else if (chunkStorage === StorageMode.MINIO) {
      this.chunksStorageEngine = new MinioStorage(() => MinioConfigObject.load(), {
        defaultBucket: 'chunks',
      });
    } else {
      this.chunksStorageEngine = new LocalStorage(Global.uploadPath, 'chunks');
    }

    logger.log(
      `initStorageEngine ${r({
        videos: this.videosStorageEngine,
        chunks: this.chunksStorageEngine,
        local: this.localStorageEngine,
        files: this.filesStorageEngine,
      })}`,
    );
  }

  public getFilePath(fullpath: string): string {
    return join(Global.uploadPath, '../', fullpath);
  }

  public get defaultModulePrefix(): string {
    return this.opts.defaultModulePrefix || 'www';
  }

  public static get isDebugMode(): boolean {
    return configLoader.loadConfig(ConfigKeys.DEBUG);
  }
}
