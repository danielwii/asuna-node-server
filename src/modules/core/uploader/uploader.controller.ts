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
import { ApiConsumes, ApiImplicitFile, ApiImplicitQuery, ApiUseTags } from '@nestjs/swagger';
import * as bluebird from 'bluebird';
import { Validator } from 'class-validator';
import { oneLineTrim } from 'common-tags';
import * as _ from 'lodash';
import * as multer from 'multer';
import { join } from 'path';
import * as uuid from 'uuid';
import { AsunaError, AsunaException, r, UploadException } from '../../common';
import { ConfigKeys, configLoader } from '../config.helper';
import { AsunaContext } from '../context';
import { DocMimeType, ImageMimeType, VideoMimeType } from '../storage';

const logger = new Logger('UploaderController');

@ApiUseTags('core')
@Controller('api/v1/uploader')
export class UploaderController {
  private context = AsunaContext.instance;

  // @ApiBearerAuth() TODO add auth both accepted with client and server auth
  @ApiConsumes('multipart/form-data')
  @ApiImplicitFile({ name: 'files', required: true, description: 'List of files' })
  @ApiImplicitQuery({
    name: 'local',
    enum: ['1'],
    required: false,
    description: 'force use local storage',
  })
  @Post()
  @UseInterceptors(
    FilesInterceptor('files', 3, {
      storage: multer.diskStorage({
        filename(req, file, cb) {
          cb(null, `${uuid.v4()}.${file.mimetype.split('/').slice(-1)}__${file.originalname}`);
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
    @Query('local') local: string, // 是否使用本地存储
    @Req() req,
    @UploadedFiles() files,
  ) {
    logger.log(JSON.stringify({ bucket, prefix, files, err: req.fileValidationError }));
    if (req.fileValidationError) {
      throw new UploadException(req.fileValidationError);
    }
    const results = await bluebird
      .map(files, (file: any) => {
        if (local === '1') {
          logger.log(
            `save file[${file.mimetype}] to local storage [${bucket}-${prefix}]...${file.filename}`,
          );
          return this.context.localStorageEngine.saveEntity(file, { bucket, prefix });
        }

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
          no storage engine defined for file type [${file.mimetype}]
          to bucket(${bucket})/prefix(${prefix}) - ${file.filename}, 
          using normal file storage engine.
        `);
        return this.context.fileStorageEngine.saveEntity(file, { bucket, prefix });
      })
      .catch(error => {
        logger.error(error.message, error.trace);
        throw new AsunaException(AsunaError.Unprocessable, error.message);
      });
    logger.log(`results is ${r(results)}`);
    return results.map(saved => ({
      ...saved,
      // 用于访问的资源地址
      fullpath: join(
        configLoader.loadConfig(ConfigKeys.RESOURCE_PATH) || '/uploads',
        saved.bucket,
        saved.prefix,
        saved.filename,
      ),
    }));
  }
}
