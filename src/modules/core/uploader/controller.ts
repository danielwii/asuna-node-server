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
import * as bluebird from 'bluebird';
import { Transform } from 'class-transformer';
import { IsNumber, IsString, Min, Validator } from 'class-validator';
import { oneLineTrim } from 'common-tags';
import * as fsExtra from 'fs-extra';
import * as highland from 'highland';
import * as _ from 'lodash';
import * as mime from 'mime-types';
import * as multer from 'multer';
import { join } from 'path';
import * as uuid from 'uuid';
import { AsunaError, AsunaException, isBlank, r, sha1, UploadException } from '../../common';
import { ControllerLoggerInterceptor } from '../../logger/logger.interceptor';
import { AnyAuthGuard, AnyAuthRequest } from '../auth';
import { ConfigKeys, configLoader } from '../config.helper';
import { AsunaContext } from '../context';
import { DocMimeType, ImageMimeType, VideoMimeType } from '../storage';
import { OperationTokenGuard, OperationTokenRequest } from '../token';
import { UploaderHelper } from './helper';
import { UploaderService } from './service';

const os = require('os');
const assert = require('assert');

const logger = new Logger('UploaderController');

class CreateChunksUploadTaskDTO {
  @IsString()
  @Transform(value => _.trim(value))
  key: string;
  @IsNumber()
  @Min(1)
  totalChunks: number;
}

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
@UseInterceptors(ControllerLoggerInterceptor)
@Controller('api/v1/uploader')
export class UploaderController {
  private context = AsunaContext.instance;

  constructor(private readonly uploaderService: UploaderService) {}

  @UseGuards(AnyAuthGuard)
  @Post('create-chunks-upload-task')
  createChunksUploadTask(@Body() dto: CreateChunksUploadTaskDTO, @Req() req: AnyAuthRequest) {
    const { identifier } = req;
    return UploaderHelper.createChunksUploadTask(identifier, dto.key, dto.totalChunks);
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
    assert.strictEqual(!isBlank(filename), true, 'filename needed');
    assert.strictEqual(!isBlank(chunk), true, 'chunk needed');

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
    const saved = await this.uploaderService.uploadChunks(token, filename, tempFile, chunk);

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
    assert.strictEqual(!isBlank(filename), true, 'filename needed');
    assert.strictEqual(!isBlank(chunk), true, 'chunk needed');

    const tempFile = `${os.tmpdir()}/${filename}.${chunk}`;
    const stream = fsExtra.createWriteStream(tempFile);
    req.pipe(stream);
    req.on('end', () => {
      logger.log(`save to ${tempFile} done.`);
    });

    const { identifier } = req;
    if (req.fileValidationError) {
      throw new UploadException(req.fileValidationError);
    }
    const fingerprint = sha1({ identifier, filename });
    const chunkname = `${file.filename}.${chunk}`;
    logger.log(
      `upload chunk file ${r({ filename, chunkname, file, identifier, fingerprint, chunk })}`,
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
  async mergeChunks(
    @Query('filename') filename: string,
    @Query('bucket') bucket: string = '',
    @Query('prefix') prefix: string = '',
    // @Query('totalChunks') totalChunks: number,
    @Req() req: AnyAuthRequest,
  ) {
    assert.strictEqual(!isBlank(filename), true, 'filename needed');
    // assert.strictEqual(totalChunks > 0, true, 'totalChunks count not received');

    const { identifier } = req;
    const fingerprint = sha1({ identifier, filename });
    logger.log(`merge file '${filename}' chunks... ${r({ prefix: fingerprint })}`);
    const chunks = await this.context.chunkStorageEngine.listEntities({ prefix: fingerprint });
    logger.log(`found chunks: ${r(chunks)}`);

    // TODO task should bind with a token(OperationToken)
    if (!(chunks && chunks.length)) {
      throw new AsunaException(
        AsunaError.Unprocessable,
        `no chunks found for ${filename} with fingerprint: ${fingerprint}`,
      );
    }

    // try to merge all chunks
    logger.log(`try to merge chunks: ${r(chunks)}`);
    const filepaths = await bluebird.all(
      chunks.map(chunk =>
        this.context.chunkStorageEngine.getEntity(chunk, AsunaContext.instance.tempPath),
      ),
    );
    const tempDirectory = join(AsunaContext.instance.tempPath, 'chunks', fingerprint);
    fsExtra.mkdirsSync(tempDirectory);
    const dest = join(tempDirectory, filename);
    logger.log(`merge files: ${r(filepaths)} to ${dest}`);
    const writableStream = fsExtra.createWriteStream(dest);

    highland(filepaths)
      .map(fsExtra.createReadStream)
      .flatMap(highland)
      .pipe(writableStream);

    await new Promise(resolve => {
      writableStream.on('close', () => {
        logger.log(`merge file done: ${dest}, clean chunks ...`);
        resolve();
        filepaths.forEach(filepath => {
          logger.log(`remove ${filepath} ...`);
          fsExtra
            .remove(filepath)
            .catch(reason => logger.warn(`remove ${filepath} error: ${r(reason)}`));
        });
      });
    });

    const mimetype = mime.lookup(filename) || 'application/octet-stream';
    const saved = await this.context.fileStorageEngine.saveEntity(
      {
        filename,
        path: dest,
        mimetype,
        extension: mime.extension(mimetype) || 'bin',
      },
      { bucket, prefix },
    );

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
