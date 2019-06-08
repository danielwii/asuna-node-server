import {
  Controller,
  Logger,
  Post,
  Query,
  Req,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import * as bluebird from 'bluebird';
import { Validator } from 'class-validator';
import * as multer from 'multer';
import * as _ from 'lodash';
import * as uuid from 'uuid';

import { AdminModule } from '../../admin.module';
import { UploadException } from '../../base';
import { ConfigKeys, configLoader } from '../../helpers';
import { DocMimeType, ImageMimeType, VideoMimeType } from '../storage/storage.constants';
import {
  IStorageEngine,
  LocalStorage,
  MinioStorage,
  QiniuStorage,
  StorageMode,
} from '../storage/storage.engines';
import { MinioConfigObject, QiniuConfigObject } from '../storage/config.object';
import { DynamicConfigKeys, DynamicConfigs } from '../../config/dynamicConfigs';

const logger = new Logger('UploaderController');

@Controller('api/uploader')
export class UploaderController {
  public static imageStorageEngine: IStorageEngine;
  public static videoStorageEngine: IStorageEngine;
  public static fileStorageEngine: IStorageEngine;

  /**
   * TODO 根据环境变量不同创建存储引擎
   */
  constructor() {
    const imageStorage = configLoader.loadConfig(ConfigKeys.IMAGE_STORAGE);
    if (imageStorage === StorageMode.QINIU) {
      UploaderController.imageStorageEngine = new QiniuStorage(() =>
        QiniuConfigObject.load('image'),
      );
      DynamicConfigs.setup(DynamicConfigKeys.imageStorage, {
        mode: StorageMode.QINIU,
        loader: () => QiniuConfigObject.load('image'),
      });
    } else if (imageStorage === StorageMode.MINIO) {
      UploaderController.imageStorageEngine = new MinioStorage(() => MinioConfigObject.load());
      DynamicConfigs.setup(DynamicConfigKeys.imageStorage, {
        mode: StorageMode.MINIO,
        loader: () => MinioConfigObject.load(),
      });
    } else {
      UploaderController.imageStorageEngine = new LocalStorage(AdminModule.uploadPath);
      DynamicConfigs.setup(DynamicConfigKeys.imageStorage, { mode: StorageMode.LOCAL });
    }

    const videoStorage = configLoader.loadConfig(ConfigKeys.VIDEO_STORAGE);
    if (videoStorage === StorageMode.QINIU) {
      UploaderController.videoStorageEngine = new QiniuStorage(() =>
        QiniuConfigObject.load('video'),
      );
    } else if (videoStorage === StorageMode.MINIO) {
      UploaderController.videoStorageEngine = new MinioStorage(() => MinioConfigObject.load());
    } else {
      UploaderController.videoStorageEngine = new LocalStorage(AdminModule.uploadPath, 'videos');
    }

    const fileStorage = configLoader.loadConfig(ConfigKeys.FILE_STORAGE);
    if (fileStorage === StorageMode.QINIU) {
      UploaderController.fileStorageEngine = new QiniuStorage(() => QiniuConfigObject.load('file'));
    } else if (fileStorage === StorageMode.MINIO) {
      UploaderController.fileStorageEngine = new MinioStorage(() => MinioConfigObject.load());
    } else {
      UploaderController.fileStorageEngine = new LocalStorage(AdminModule.uploadPath, 'files');
    }
  }

  @Post()
  @UseInterceptors(
    FilesInterceptor('files', 3, {
      storage: multer.diskStorage({
        filename(req, file, cb) {
          cb(null, `${uuid.v4()}.${file.mimetype.split('/').slice(-1)}`);
        },
      }),
      fileFilter(req, file, cb) {
        const validator = new Validator();
        const supportedImage = validator.isEnum(file.mimetype, ImageMimeType);
        const supportedVideo = validator.isEnum(file.mimetype, VideoMimeType);
        const supportedDoc = validator.isEnum(file.mimetype, DocMimeType);
        logger.log(
          `validate file ${JSON.stringify({ supportedImage, supportedVideo, supportedDoc })}`,
        );
        if (!(supportedImage || supportedVideo || supportedDoc)) {
          // req.fileValidationError = `unsupported mime type: '${file.mimetype}'`;
          logger.warn(`unsupported mime type: ${file.mimetype}, save as normal file.`);
          cb(null, true);
        } else {
          cb(null, true);
        }
      },
    }),
  )
  async upload(
    @Query('bucket') bucket: string = '',
    @Query('prefix') prefix: string = '',
    @Req() req,
    @UploadedFiles() files,
  ) {
    logger.log(JSON.stringify({ bucket, prefix, files, err: req.fileValidationError }));
    if (req.fileValidationError) {
      throw new UploadException(req.fileValidationError);
    }
    const results = await bluebird
      .map(files, (file: any) => {
        if (_.includes(ImageMimeType, file.mimetype)) {
          logger.log(`save image[${file.mimetype}]...${file.filename}`);
          return UploaderController.imageStorageEngine.saveEntity(file, { bucket, prefix });
        } else if (_.includes(VideoMimeType, file.mimetype)) {
          logger.log(`save video[${file.mimetype}]...${file.filename}`);
          return UploaderController.videoStorageEngine.saveEntity(file, { bucket, prefix });
        } else if (_.includes(DocMimeType, file.mimetype)) {
          // TODO reuse videoStorageEngine, create a common handler later
          logger.log(`save doc[${file.mimetype}]...${file.filename}`);
          return UploaderController.imageStorageEngine.saveEntity(file, { bucket, prefix });
        } else {
          logger.log(
            `no storage engine defined for file type [${file.mimetype}]...` +
              `${prefix} - ${file.filename}, using normal file storage engine.`,
          );
          file.filename = `${file.filename}__${file.originalname}`;
          return UploaderController.fileStorageEngine.saveEntity(file, { bucket, prefix });
        }
      })
      .catch(error => {
        logger.error(error.message, error.trace);
      });
    logger.log(`results is ${JSON.stringify(results)}`);
    return results;
  }
}
