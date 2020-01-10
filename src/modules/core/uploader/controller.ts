import { Controller, Post, Query, Req, UploadedFile, UploadedFiles, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import * as assert from 'assert';
import { Promise } from 'bluebird';
import { Transform } from 'class-transformer';
import { IsNumber, IsOptional, IsString, Min, Validator } from 'class-validator';
import { oneLineTrim } from 'common-tags';
import * as fs from 'fs-extra';
import * as _ from 'lodash';
import * as multer from 'multer';
import * as os from 'os';
import { basename, dirname, join } from 'path';
import * as uuid from 'uuid';
import { isBlank, r, UploadException } from '../../common';
import { LoggerFactory } from '../../common/logger';
import { ConfigKeys, configLoader } from '../../config';
import { AnyAuthRequest } from '../../helper/auth';
import { AnyAuthGuard } from '../auth/auth.guard';
import { AsunaContext } from '../context';
import { DocMimeType, FileInfo, ImageMimeType, SavedFile, VideoMimeType } from '../storage';
import { OperationToken, OperationTokenGuard, OperationTokenRequest } from '../token';
import { UploaderHelper } from './helper';
import { RemoteFileInfo, UploaderService } from './service';

const logger = LoggerFactory.getLogger('UploaderController');

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

class CreateChunksUploadTaskDto {
  @IsString()
  @Transform(value => _.trim(value))
  filename: string;

  @IsNumber()
  @Min(1)
  totalChunks: number;
}

class CreateChunksUploadTaskQuery {
  @IsString()
  @Transform(value => _.trim(value))
  readonly key: string;

  @IsString()
  @Transform(value => _.trim(value))
  readonly filename: string;

  @IsNumber()
  @Min(1)
  @IsOptional()
  @Transform(value => Number(value))
  readonly totalChunks: number = 1;
}

@ApiTags('core')
@Controller('api/v1/uploader')
export class UploaderController {
  private context = AsunaContext.instance;

  constructor(private readonly uploaderService: UploaderService) {}

  /**
   * 创建 chunk 上传任务
   * @param query
   * @param req
   */
  @UseGuards(AnyAuthGuard)
  @Post('create-chunks-upload-task')
  createChunksUploadTask(
    @Query() query: CreateChunksUploadTaskQuery,
    @Req() req: AnyAuthRequest,
  ): Promise<OperationToken> {
    const { identifier } = req;
    logger.log(`createChunksUploadTask: ${r(query)}`);
    return UploaderHelper.createChunksUploadTask({ ...query, identifier });
  }

  /**
   * 流式上传 chunk
   * @param filename
   * @param chunk
   * @param req
   */
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Stream upload chunked file' })
  @ApiConsumes('multipart/form-data')
  @ApiQuery({
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
  ): Promise<RemoteFileInfo> {
    assert(!isBlank(filename), 'filename needed');
    assert(!isBlank(chunk), 'chunk needed');

    // save uploaded file to temp dir
    const tempFile = `${os.tmpdir()}/${filename}.${chunk}`;
    const stream = fs.createWriteStream(tempFile);
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

  /**
   * 基于 operation-token 上传 chunk
   * @param filename
   * @param chunk
   * @param req
   * @param file
   */
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Chunked upload file' })
  @ApiConsumes('multipart/form-data')
  @ApiQuery({
    name: 'chunk',
    required: false,
    description: 'chunked upload file index',
  })
  @UseGuards(AnyAuthGuard, OperationTokenGuard)
  @Post('chunks')
  @UseInterceptors(FileInterceptor('file', fileInterceptorOptions))
  async chunkedUploader(
    @Query('filename') filename: string,
    @Query('chunk') chunk: number,
    @Req() req: AnyAuthRequest & OperationTokenRequest,
    @UploadedFile() file,
  ): Promise<RemoteFileInfo> {
    assert(!isBlank(filename), 'filename needed');
    assert(!isBlank(chunk), 'chunk needed');

    return this.uploaderService.uploadChunks(req.token, filename, file.path, chunk);
  }

  /**
   * 合并 chunks
   * @param filename
   * @param req
   */
  @UseGuards(AnyAuthGuard, OperationTokenGuard)
  @Post('merge-chunks')
  async mergeChunks(
    @Query('filename') filename: string,
    @Req() req: AnyAuthRequest & OperationTokenRequest,
  ): Promise<RemoteFileInfo> {
    return this.uploaderService.mergeChunks(req.token, filename);
  }

  /**
   * 直接上传文件
   * @param bucket
   * @param prefix
   * @param local 在某些可能需要同一个 server 执行任务时可能需要
   * @param req
   * @param files
   */
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Upload files' })
  @ApiConsumes('multipart/form-data')
  @ApiQuery({
    name: 'local',
    enum: ['1'],
    required: false,
    description: 'force use local storage',
  })
  @UseGuards(AnyAuthGuard)
  @Post()
  @UseInterceptors(
    // new FastifyFileInterceptor('files'),
    FilesInterceptor('files', configLoader.loadNumericConfig(ConfigKeys.UPLOADER_MAX_COUNT, 3), fileInterceptorOptions),
  )
  async uploader(
    @Query('bucket') bucket = '',
    @Query('prefix') prefix = '',
    @Query('local') local: string, // 是否使用本地存储
    @Req() req: AnyAuthGuard,
    @UploadedFiles() files,
  ): Promise<SavedFile[]> {
    /*
    if (req.fileValidationError) {
      throw new UploadException(req.fileValidationError);
    } */
    logger.log(`upload files ${r({ bucket, prefix, files })}`);
    const results = await this.saveFiles(bucket, prefix, local, files).catch(error => {
      logger.error(`upload files ${r({ bucket, prefix, files })} error: ${r(error)}`);
      // fs.rmdir(tempFolder).catch(reason => logger.warn(r(reason)));
      throw new UploadException(error);
    });
    logger.log(`results is ${r(results)}`);
    return results;
  }

  /**
   * 流式上传
   */
  // @UseGuards(AnyAuthGuard)
  @Post('stream')
  async streamUpload(
    @Query('bucket') bucket = '',
    @Query('prefix') prefix = '',
    @Query('filename') filename: string,
    @Req() req, // : AnyAuthRequest,
  ): Promise<SavedFile> {
    const fixedPrefix = join(prefix, dirname(filename));
    const baseFilename = basename(filename);

    const tempDir = join(AsunaContext.instance.tempPath, 'stream');
    await fs.ensureDir(tempDir);
    const tempFolder = await fs.mkdtemp(join(tempDir, 'temp-'));
    logger.log(`create temp folder: ${tempFolder}`);
    const tempFile = join(tempFolder, baseFilename);
    const stream = fs.createWriteStream(tempFile);
    req.pipe(stream);

    await new Promise(resolve => {
      req.on('end', () => {
        logger.log(`save to ${tempFile} done.`);
        resolve();
      });
    });

    const fileInfo = new FileInfo({ filename: baseFilename, path: tempFile });
    // fileInfo.filename = `${uuid.v4()}.${fileInfo.mimetype.split('/').slice(-1)}__${baseFilename}`;
    const results = await this.saveFiles(bucket, fixedPrefix, '0', [fileInfo]).catch(error => {
      logger.error(`save ${r({ bucket, fixedPrefix, fileInfo })} error: ${r(error)}`);
      // fs.rmdir(tempFolder).catch(reason => logger.warn(r(reason)));
      throw new UploadException(error);
    });
    // TODO remove temp files in storage engine now
    // fs.rmdir(tempFolder).catch(reason => logger.warn(r(reason)));
    logger.log(`results is ${r(results)}`);
    return _.first(results);
  }

  private saveFiles(bucket: string, prefix: string, local: string, files: FileInfo[]): Promise<SavedFile[]> {
    return Promise.map(files, file => {
      if (local === '1') {
        logger.log(oneLineTrim`
            save file[${file.mimetype}] to local storage
            ${r({ bucket, prefix, filename: file.filename })}
          `);
        return this.context.localStorageEngine.saveEntity(file, { bucket, prefix });
      }

      if (_.includes(ImageMimeType, file.mimetype)) {
        logger.log(`save image[${file.mimetype}] to ${r({ bucket, prefix })} filename: ${file.filename}`);
        return this.context.defaultStorageEngine.saveEntity(file, { bucket, prefix });
      }
      if (_.includes(VideoMimeType, file.mimetype)) {
        logger.log(`save video[${file.mimetype}] to ${r({ bucket, prefix })} filename: ${file.filename}`);
        return this.context.videoStorageEngine.saveEntity(file, { bucket, prefix });
      }
      if (_.includes(DocMimeType, file.mimetype)) {
        logger.log(`save doc[${file.mimetype}] to ${r({ bucket, prefix })} filename: ${file.filename}`);
        return this.context.fileStorageEngine.saveEntity(file, { bucket, prefix });
      }
      logger.log(oneLineTrim`
          no storage engine defined for file type [${file.mimetype}]
          to ${r({ bucket, prefix, filename: file.filename })},
          using normal file storage engine.
        `);
      return this.context.fileStorageEngine.saveEntity(file, { bucket, prefix });
    });
  }
}
