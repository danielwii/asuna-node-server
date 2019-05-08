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
import * as util from 'util';
import * as _ from 'lodash';
import * as uuid from 'uuid';

import { AdminModule } from '../../admin.module';
import { UploadException } from '../../base';
import { ConfigKeys, configLoader } from '../../helpers';
import { DocMimeType, ImageMimeType, VideoMimeType } from '../storage/storage.constants';
import { IStorageEngine, LocalStorage, QiniuStorage } from '../storage/storage.engines';

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
    UploaderController.imageStorageEngine =
      imageStorage === 'qiniu'
        ? new QiniuStorage(
            configLoader.loadConfig(ConfigKeys.IMAGE_QINIU_BUCKET_NAME),
            configLoader.loadConfig(ConfigKeys.IMAGE_QINIU_PREFIX),
            configLoader.loadConfig(ConfigKeys.IMAGE_QINIU_ACCESS_KEY),
            configLoader.loadConfig(ConfigKeys.IMAGE_QINIU_SECRET_KEY),
          )
        : new LocalStorage(AdminModule.uploadPath);

    const videoStorage = configLoader.loadConfig(ConfigKeys.VIDEO_STORAGE);
    UploaderController.videoStorageEngine =
      videoStorage === 'qiniu'
        ? new QiniuStorage(
            configLoader.loadConfig(ConfigKeys.VIDEO_QINIU_BUCKET_NAME),
            configLoader.loadConfig(ConfigKeys.VIDEO_QINIU_PREFIX),
            configLoader.loadConfig(ConfigKeys.VIDEO_QINIU_ACCESS_KEY),
            configLoader.loadConfig(ConfigKeys.VIDEO_QINIU_SECRET_KEY),
          )
        : new LocalStorage(AdminModule.uploadPath, 'videos');

    UploaderController.fileStorageEngine = new LocalStorage(AdminModule.uploadPath, 'files');
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
          `validate file ${util.inspect(
            { supportedImage, supportedVideo, supportedDoc },
            { colors: true },
          )}`,
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
  async upload(@Query('prefix') prefix: string = '', @Req() req, @UploadedFiles() files) {
    logger.log(util.inspect({ prefix, files, err: req.fileValidationError }, { colors: true }));
    if (req.fileValidationError) {
      throw new UploadException(req.fileValidationError);
    }
    const results = await bluebird
      .map(files, (file: any) => {
        if (_.includes(ImageMimeType, file.mimetype)) {
          logger.log(`save image[${file.mimetype}]...${file.filename}`);
          return UploaderController.imageStorageEngine.saveEntity(file, prefix);
        } else if (_.includes(VideoMimeType, file.mimetype)) {
          logger.log(`save video[${file.mimetype}]...${file.filename}`);
          return UploaderController.videoStorageEngine.saveEntity(file, prefix);
        } else if (_.includes(DocMimeType, file.mimetype)) {
          // TODO reuse videoStorageEngine, create a common handler later
          logger.log(`save doc[${file.mimetype}]...${file.filename}`);
          return UploaderController.imageStorageEngine.saveEntity(file, prefix);
        } else {
          logger.log(
            `no storage engine defined for file type [${file.mimetype}]...${prefix} - ${
              file.filename
            }, using normal file storage engine.`,
          );
          file.filename = `${file.filename}__${file.originalname}`;
          return UploaderController.fileStorageEngine.saveEntity(file, prefix);
        }
      })
      .catch(error => {
        logger.error(error.message, error.trace);
      });
    logger.log(`results is ${util.inspect(results, { colors: true })}`);
    return results;
  }
}
