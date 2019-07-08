import {
  Controller,
  Logger,
  Post,
  Query,
  Req,
  UploadedFile,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiConsumes,
  ApiImplicitFile,
  ApiImplicitQuery,
  ApiOperation,
  ApiUseTags,
} from '@nestjs/swagger';
import * as bluebird from 'bluebird';
import { Validator } from 'class-validator';
import { oneLineTrim } from 'common-tags';
import * as _ from 'lodash';
import * as multer from 'multer';
import { join } from 'path';
import * as uuid from 'uuid';
import { isBlank, r, sha1, sha256, UploadException } from '../../common';
import { AnyAuthGuard, AnyAuthRequest } from '../auth';
import { ConfigKeys, configLoader } from '../config.helper';
import { AsunaContext } from '../context';
import { DocMimeType, ImageMimeType, VideoMimeType } from '../storage';

const assert = require('assert');

const logger = new Logger('UploaderController');

const fileInterceptorOptions = {
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
    logger.log(`validate file ${r({ supportedImage, supportedVideo, supportedDoc })}`);
    if (!(supportedImage || supportedVideo || supportedDoc)) {
      // req.fileValidationError = `unsupported mime type: '${file.mimetype}'`;
      logger.log(`unsupported mime type: ${file.mimetype}, save as normal file.`);
      cb(null, true);
    } else {
      cb(null, true);
    }
  },
};

@ApiUseTags('core')
@Controller('api/v1/uploader')
export class UploaderController {
  private context = AsunaContext.instance;

  @ApiBearerAuth()
  @ApiOperation({ title: 'Chunked upload file' })
  @ApiConsumes('multipart/form-data')
  @ApiImplicitFile({ name: 'file', required: true, description: 'chunked file block' })
  @ApiImplicitQuery({
    name: 'chunk',
    required: false,
    description: 'chunked upload file index',
  })
  @UseGuards(AnyAuthGuard)
  @Post('chunks')
  @UseInterceptors(FileInterceptor('file', fileInterceptorOptions))
  async chunkedUploader(
    @Query('filename') filename: string,
    @Query('chunk') chunk: number,
    @Req() req: AnyAuthRequest & { fileValidationError: any },
    @UploadedFile() file,
  ) {
    assert.strictEqual(isBlank(filename), false, 'filename needed');
    assert.strictEqual(isBlank(chunk), false, 'chunk needed');

    const { authObject } = req;
    if (req.fileValidationError) {
      throw new UploadException(req.fileValidationError);
    }
    const fingerprint = sha1({ authObject, filename });
    const chunkname = `${file.filename}.${chunk}`;
    logger.log(
      `upload chunk file ${r({ filename, chunkname, file, authObject, fingerprint, chunk })}`,
    );

    file.filename = chunkname;
    const saved = await this.context.chunkStorageEngine.saveEntity(file, { prefix: fingerprint });

    return {
      ...saved,
      // 用于访问的资源地址
      fullpath: join(
        configLoader.loadConfig(ConfigKeys.RESOURCE_PATH) || '/uploads',
        saved.bucket,
        saved.prefix,
        saved.filename,
      ),
    };
  }

  @UseGuards(AnyAuthGuard)
  @Post('merge-chunks')
  async mergeChunks() {}

  @ApiBearerAuth()
  @ApiOperation({ title: 'Upload files' })
  @ApiConsumes('multipart/form-data')
  @ApiImplicitFile({ name: 'files', required: true, description: 'List of files' })
  @ApiImplicitQuery({
    name: 'local',
    enum: ['1'],
    required: false,
    description: 'force use local storage',
  })
  @ApiImplicitQuery({
    name: 'chunk',
    required: false,
    description: 'chunked upload files index',
  })
  @UseGuards(AnyAuthGuard)
  @Post()
  @UseInterceptors(
    FilesInterceptor(
      'files',
      configLoader.loadNumericConfig(ConfigKeys.UPLOADER_MAX_COUNT, 3),
      fileInterceptorOptions,
    ),
  )
  async uploader(
    @Query('bucket') bucket: string = '',
    @Query('prefix') prefix: string = '',
    @Query('local') local: string, // 是否使用本地存储
    @Query('chunk') chunk: number,
    @Req() req,
    @UploadedFiles() files,
  ) {
    if (req.fileValidationError) {
      throw new UploadException(req.fileValidationError);
    }
    logger.log(`upload files ${r({ bucket, prefix, files })}`);
    const results = await bluebird
      .map(files, (file: any) => {
        if (local === '1') {
          logger.log(oneLineTrim`
            save file[${file.mimetype}] to local storage 
            ${r({ bucket, prefix, filename: file.filename })}
          `);
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
          to ${r({ bucket, prefix, filename: file.filename })}, 
          using normal file storage engine.
        `);
        return this.context.fileStorageEngine.saveEntity(file, { bucket, prefix });
      })
      .catch(error => {
        logger.error(r(error));
        throw new UploadException(error);
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
