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
import { oneLineTrim } from 'common-tags';
import * as multer from 'multer';
import * as _ from 'lodash';
import * as uuid from 'uuid';

import { AsunaError, AsunaException, UploadException } from '../base';
import { DocMimeType, ImageMimeType, VideoMimeType } from '../storage';
import { AsunaContext } from '../context';

const logger = new Logger('UploaderController');

@Controller('api/uploader')
export class UploaderController {
  private context = AsunaContext.instance;

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
          logger.log(`save image[${file.mimetype}] to [${bucket}-${prefix}]...${file.filename}`);
          return this.context.defaultStorageEngine.saveEntity(file, { bucket, prefix });
        }
        if (_.includes(VideoMimeType, file.mimetype)) {
          logger.log(`save video[${file.mimetype}] to [${bucket}-${prefix}]...${file.filename}`);
          return this.context.videoStorageEngine.saveEntity(file, { bucket, prefix });
        }
        if (_.includes(DocMimeType, file.mimetype)) {
          logger.log(`save doc[${file.mimetype}] to [${bucket}-${prefix}]...${file.filename}`);
          return this.context.fileStorageEngine.saveEntity(file, { bucket, prefix });
        }
        logger.log(oneLineTrim`
          no storage engine defined for file type [${file.mimetype}]...
          to [${bucket}-${prefix}] - ${file.filename}, using normal file storage engine.
        `);
        file.filename = `${file.filename}__${file.originalname}`;
        return this.context.fileStorageEngine.saveEntity(file, { bucket, prefix });
      })
      .catch(error => {
        console.error(error);
        logger.error(error.message, error.trace);
        throw new AsunaException(AsunaError.Unprocessable, error.message);
      });
    logger.log(`results is ${JSON.stringify(results)}`);
    return results;
  }
}
