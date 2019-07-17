import {
  Body,
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
import * as assert from 'assert';
import * as bluebird from 'bluebird';
import { Transform } from 'class-transformer';
import { IsNumber, IsString, Min, Validator } from 'class-validator';
import { oneLineTrim } from 'common-tags';
import * as fsExtra from 'fs-extra';
import * as _ from 'lodash';
import * as multer from 'multer';
import * as os from 'os';
import { join } from 'path';
import * as uuid from 'uuid';
import { isBlank, r, UploadException } from '../../common';
import { ControllerLoggerInterceptor } from '../../logger';
import { AnyAuthGuard, AnyAuthRequest } from '../auth';
import { ConfigKeys, configLoader } from '../config.helper';
import { AsunaContext } from '../context';
import { DocMimeType, ImageMimeType, VideoMimeType } from '../storage';
import { OperationTokenGuard, OperationTokenRequest } from '../token';
import { UploaderHelper } from './helper';
import { UploaderService } from './service';

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
    }
    cb(null, true);
  },
};

class CreateChunksUploadTaskDTO {
  @IsString()
  @Transform(value => _.trim(value))
  filename: string;
  @IsNumber()
  @Min(1)
  totalChunks: number;
}

@ApiUseTags('core')
@UseInterceptors(ControllerLoggerInterceptor)
@Controller('api/v1/uploader')
export class UploaderController {
  private context = AsunaContext.instance;

  constructor(private readonly uploaderService: UploaderService) {}

  @UseGuards(AnyAuthGuard)
  @Post('create-chunks-upload-task')
  createChunksUploadTask(@Body() dto: CreateChunksUploadTaskDTO, @Req() req: AnyAuthRequest) {
    const { identifier } = req;
    return UploaderHelper.createChunksUploadTask(identifier, dto.filename, dto.totalChunks);
  }

  @ApiBearerAuth()
  @ApiOperation({ title: 'Stream upload chunked file' })
  @ApiConsumes('multipart/form-data')
  @ApiImplicitQuery({
    name: 'chunk',
    required: false,
    description: 'chunked upload file index',
  })
  @UseGuards(AnyAuthGuard, OperationTokenGuard)
  @Post('chunks-stream')
  async streamChunkedUploader(
    @Query('filename') filename: string,
    @Query('chunk') chunk: number,
    @Req() req: AnyAuthRequest & OperationTokenRequest,
  ) {
    assert(!isBlank(filename), 'filename needed');
    assert(!isBlank(chunk), 'chunk needed');

    // save uploaded file to temp dir
    const tempFile = `${os.tmpdir()}/${filename}.${chunk}`;
    const stream = fsExtra.createWriteStream(tempFile);
    req.pipe(stream);

    await new Promise(resolve => {
      req.on('end', () => {
        logger.log(`save to ${tempFile} done.`);
        resolve();
      });
    });

    const { token } = req;
    return this.uploaderService.uploadChunks(token, filename, tempFile, chunk);
  }

  @ApiBearerAuth()
  @ApiOperation({ title: 'Chunked upload file' })
  @ApiConsumes('multipart/form-data')
  @ApiImplicitFile({ name: 'file', required: true, description: 'chunked file block' })
  @ApiImplicitQuery({
    name: 'chunk',
    required: false,
    description: 'chunked upload file index',
  })
  @UseGuards(AnyAuthGuard, OperationTokenGuard)
  @Post('chunks')
  @UseInterceptors(
    FileInterceptor('file', fileInterceptorOptions),
    // new FastifyFileInterceptor('file'),
  )
  async chunkedUploader(
    @Query('filename') filename: string,
    @Query('chunk') chunk: number,
    @Req() req: AnyAuthRequest & OperationTokenRequest,
    @UploadedFile() file,
  ) {
    assert(!isBlank(filename), 'filename needed');
    assert(!isBlank(chunk), 'chunk needed');

    return this.uploaderService.uploadChunks(req.token, filename, file.path, chunk);
  }

  @UseGuards(AnyAuthGuard, OperationTokenGuard)
  @Post('merge-chunks')
  async mergeChunks(@Req() req: AnyAuthRequest & OperationTokenRequest) {
    return this.uploaderService.mergeChunks(req.token);
  }

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
    // new FastifyFileInterceptor('files'),
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
    @Req() req: AnyAuthGuard,
    @UploadedFiles() files,
  ) {
    /*
    if (req.fileValidationError) {
      throw new UploadException(req.fileValidationError);
    }*/
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
    return results;
  }
}
