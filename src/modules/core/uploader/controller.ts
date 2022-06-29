import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

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
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';

import { AsunaExceptionHelper, AsunaExceptionTypes } from '@danielwii/asuna-helper/dist/exceptions';
import { resolveModule } from '@danielwii/asuna-helper/dist/logger/factory';
import { r } from '@danielwii/asuna-helper/dist/serializer';
import { ApiResponse } from '@danielwii/asuna-shared/dist/vo';

import { Promise } from 'bluebird';
import { Transform } from 'class-transformer';
import { isEnum, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { oneLineTrim } from 'common-tags';
import * as fs from 'fs-extra';
import _ from 'lodash';
import * as mime from 'mime-types';
import * as multer from 'multer';
import * as os from 'os';
import ow from 'ow';
import { basename, dirname, extname, join } from 'path';
import * as uuid from 'uuid';

import { named } from '../../helper';
import { AnyAuthGuard } from '../auth/auth.guard';
import { AsunaContext } from '../context';
import { Global } from '../global';
import { DocMimeType, FileInfo, ImageMimeType, MinioStorage, SavedFile, VideoMimeType } from '../storage';
import { OperationToken, OperationTokenGuard, OperationTokenRequest } from '../token';
import { UploaderConfigObject } from './config';
import { UploaderHelper } from './helper';
import { RemoteFileInfo, UploaderService } from './service';

import type { MulterOptions } from '@nestjs/platform-express/multer/interfaces/multer-options.interface';
import type { AnyAuthRequest } from '../../helper/interfaces';

const logger = new Logger(resolveModule(__filename));

const fileInterceptorOptions: MulterOptions = {
  storage: multer.diskStorage({
    filename(req, file, cb) {
      const mimetype = file.mimetype.split('/').slice(-1).join('');
      const lookup = mime.lookup(file.originalname);
      const extension = mime.extension(lookup || 'bin');
      const noExtName = basename(file.originalname, extname(file.originalname));
      const name = noExtName.replace('.', '_').replace(' ', '_');
      const filename = `${uuid.v4()}.${name.toLowerCase()}.${extension}`;
      logger.debug(
        `set filename ${r({ noExtName, filename, extension, mimetype, originalname: file.originalname, lookup })}`,
      );
      cb(undefined, filename);
    },
  }),
  fileFilter(req, file, cb) {
    logger.debug(`validate file ${r(file)}`);
    const supportedImage = isEnum(file.mimetype, ImageMimeType);
    const supportedVideo = isEnum(file.mimetype, VideoMimeType);
    const supportedDoc = isEnum(file.mimetype, DocMimeType);
    logger.log(`validate file ${r({ supportedImage, supportedVideo, supportedDoc })}`);
    if (!(supportedImage || supportedVideo || supportedDoc)) {
      // req.fileValidationError = `unsupported mime type: '${file.mimetype}'`;
      logger.log(`unsupported mime type: ${file.mimetype}, save as normal file.`);
    }
    cb(undefined, true);
  },
};

class CreateChunksUploadTaskDTO {
  @IsString()
  @Transform(({ value }) => _.trim(value))
  filename: string;

  @IsNumber()
  @Min(1)
  totalChunks: number;
}

class CreateChunksUploadTaskQuery {
  @IsString()
  @Transform(({ value }) => _.trim(value))
  readonly key: string;

  @IsString()
  @Transform(({ value }) => _.trim(value))
  readonly filename: string;

  @IsNumber()
  @Min(1)
  @IsOptional()
  @Transform(({ value }) => Number(value))
  readonly totalChunks: number = 1;
}

@ApiTags('core')
@Controller('api/v1/uploader')
export class UploaderController {
  private context = AsunaContext.instance;

  constructor(private readonly uploaderService: UploaderService) {}

  @UseGuards(AnyAuthGuard)
  @Post('pre-signed-url')
  @named
  async getPreSignedUrl(
    @Body('bucket') bucket: string,
    @Body('prefix') prefix: string,
    @Body('filename') filename: string,
    @Req() req: AnyAuthRequest,
    funcName?: string,
  ) {
    ow(filename, 'filename', ow.string.nonEmpty);
    ow(bucket, 'bucket', ow.string.nonEmpty);
    ow(prefix, 'prefix', ow.string.nonEmpty);

    const lookup = mime.lookup(filename) as string;
    const extension = mime.extension(lookup || 'bin');
    const noExtName = basename(filename, extname(filename));
    const name = noExtName.replace('.', '_').replace(' ', '_');
    const key = `${bucket}/${prefix}/${uuid.v4()}.${name.toLowerCase()}.${extension}`;
    logger.log(`#${funcName} generate ${r({ bucket, filename, key })}`);

    // TODO assume current storage is minio
    const storageEngine = AsunaContext.instance.getStorageEngine(bucket) as MinioStorage;
    const region = storageEngine.region;
    const Bucket = storageEngine.configObject.endpoint.slice(0, storageEngine.configObject.endpoint.indexOf('s3') - 1);
    const s3Client = new S3Client({ region });
    const command = new PutObjectCommand({ Bucket, Key: key });
    const signedUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 });
    logger.log(`#${funcName} Putting "${key}" using signedUrl with bucket "${Bucket}" in v3`);
    return ApiResponse.success({ signedUrl, fullpath: `/uploads/${key}` });
  }

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
  @ApiQuery({ name: 'chunk', required: false, description: 'chunked upload file index' })
  @UseGuards(AnyAuthGuard, OperationTokenGuard)
  @Post('chunks-stream')
  async streamChunkedUploader(
    @Query('filename') filename: string,
    @Query('chunk') chunk: string,
    @Req() req: AnyAuthRequest & OperationTokenRequest,
  ): Promise<RemoteFileInfo> {
    ow(filename, 'filename', ow.string.nonEmpty);
    ow(chunk, 'chunk', ow.string.numeric);

    // save uploaded file to temp dir
    const tempFile = `${os.tmpdir()}/${filename}.${chunk}`;
    const stream = fs.createWriteStream(tempFile);
    req.pipe(stream);

    await new Promise((resolve) => {
      req.on('end', () => {
        logger.log(`save to ${tempFile} done.`);
        resolve();
      });
    });

    const { token } = req;
    return this.uploaderService.uploadChunks(token, filename, tempFile, Number(chunk));
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
  @ApiQuery({ name: 'chunk', required: false, description: 'chunked upload file index' })
  @UseGuards(AnyAuthGuard, OperationTokenGuard)
  @Post('chunks')
  @UseInterceptors(FileInterceptor('file', fileInterceptorOptions))
  async chunkedUploader(
    @Query('filename') filename: string,
    @Query('chunk') chunk: number,
    @Req() req: AnyAuthRequest & OperationTokenRequest,
    @UploadedFile() file,
  ): Promise<RemoteFileInfo> {
    ow(filename, 'filename', ow.string.nonEmpty);
    ow(chunk, 'chunk', ow.number.greaterThan(0));

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
    FilesInterceptor('files', UploaderConfigObject.instance.maxCount, fileInterceptorOptions),
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
    const results = await this.saveFiles(bucket, prefix, local, files).catch((error) => {
      logger.error(`upload files ${r({ bucket, prefix, files })} error: ${r(error)}`);
      console.error({ type: typeof error, error });
      // fs.rmdir(tempFolder).catch(reason => logger.warn(r(reason)));
      throw AsunaExceptionHelper.genericException(AsunaExceptionTypes.Upload, null, error);
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

    const tempDir = join(Global.tempPath, 'stream');
    await fs.ensureDir(tempDir);
    const tempFolder = await fs.mkdtemp(join(tempDir, 'temp-'));
    logger.log(`create temp folder: ${tempFolder}`);
    const tempFile = join(tempFolder, baseFilename);
    const stream = fs.createWriteStream(tempFile);
    req.pipe(stream);

    await new Promise((resolve) => {
      req.on('end', () => {
        logger.log(`save to ${tempFile} done.`);
        resolve();
      });
    });

    const fileInfo = new FileInfo({ filename: baseFilename, path: tempFile });
    // fileInfo.filename = `${uuid.v4()}.${fileInfo.mimetype.split('/').slice(-1)}__${baseFilename}`;
    const results = await this.saveFiles(bucket, fixedPrefix, '0', [fileInfo]).catch((error) => {
      logger.error(`save ${r({ bucket, fixedPrefix, fileInfo })} error: ${r(error)}`);
      // fs.rmdir(tempFolder).catch(reason => logger.warn(r(reason)));
      throw AsunaExceptionHelper.genericException(AsunaExceptionTypes.Upload, null, error);
    });
    // TODO remove temp files in storage engine now
    // fs.rmdir(tempFolder).catch(reason => logger.warn(r(reason)));
    logger.log(`results is ${r(results)}`);
    return _.first(results);
  }

  private saveFiles(defaultBucket: string, prefix: string, local: string, files: FileInfo[]): Promise<SavedFile[]> {
    return Promise.map(files, (file) => {
      const bucket = defaultBucket || `${file.mimetype.split('/')[0]}s`;
      if (local === '1') {
        logger.log(oneLineTrim`
            save file[${file.mimetype}] to local storage
            ${r({ bucket, prefix, filename: file.filename })}
          `);
        return this.context.localStorageEngine.saveEntity(file, { bucket, prefix });
      }

      const storageEngine = AsunaContext.instance.getStorageEngine(bucket);
      /*
      if (_.includes(ImageMimeType, file.mimetype)) {
        logger.log(`save image[${file.mimetype}] to ${r({ bucket, prefix })} filename: ${file.filename}`);
        // return this.context.defaultStorageEngine.saveEntity(file, { bucket, prefix });
      }
      if (_.includes(VideoMimeType, file.mimetype)) {
        logger.log(`save video[${file.mimetype}] to ${r({ bucket, prefix })} filename: ${file.filename}`);
        // return this.context.videosStorageEngine.saveEntity(file, { bucket, prefix });
      }
      if (_.includes(DocMimeType, file.mimetype)) {
        logger.log(`save doc[${file.mimetype}] to ${r({ bucket, prefix })} filename: ${file.filename}`);
        // return this.context.filesStorageEngine.saveEntity(file, { bucket, prefix });
      } else {
        // bucket = bucket || 'files';
        // logger.log(oneLineTrim`unresolved file type [${file.mimetype}] ${r({ bucket, prefix, filename: file.filename })}.`);
        return storageEngine.saveEntity(file, { bucket, prefix });
      } */
      return storageEngine.saveEntity(file, { bucket, prefix });
    });
  }
}
