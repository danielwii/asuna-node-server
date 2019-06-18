import { Controller, Get, Logger, NotFoundException, Param, Query, Res } from '@nestjs/common';

import * as fsExtra from 'fs-extra';
import * as path from 'path';

import { JpegParam, JpegPipe } from './image/jpeg.pipe';
import { ThumbnailParam, ThumbnailPipe } from './image/thumbnail.pipe';
import { ConfigKeys, configLoader } from './config.helper';
import { AsunaContext } from './context';
import { FinderService } from '../finder';

const logger = new Logger('GetUploadsController');

@Controller('uploads')
export class GetUploadsController {
  private context = AsunaContext.instance;

  constructor(private readonly finderService: FinderService) {}

  // TODO not finished yet
  @Get('options')
  async getOptions() {
    return {
      image: { storage: configLoader.loadConfig(ConfigKeys.IMAGE_STORAGE) },
      video: { storage: configLoader.loadConfig(ConfigKeys.VIDEO_STORAGE) },
      file: { storage: configLoader.loadConfig(ConfigKeys.FILE_STORAGE) },
    };
  }

  @Get(':bucket/*')
  async getUploads(
    @Param('bucket') bucket: string,
    @Param('0') filenameWithPrefix: string,
    @Query(ThumbnailPipe) thumbnailConfig: { opts: ThumbnailParam; param?: string },
    @Query(JpegPipe) jpegConfig: { opts: JpegParam; param?: string },
    @Res() res,
  ) {
    logger.log(
      `get [${bucket}] file [${filenameWithPrefix}] by ${JSON.stringify({
        thumbnailConfig,
        jpegConfig,
      })}`,
    );
    const url = await this.context.defaultStorageEngine.resolve({
      filename: filenameWithPrefix,
      bucket,
      thumbnailConfig,
      jpegConfig,
      resolver: url => this.finderService.getUrl('settings.finder.assets', 'assets', null, url),
    });
    logger.log(`resolved url is ${url}`);
    return res.redirect(url);
  }

  /**
   * 1. /images/2018/4/****.png
   * 1.1 /images/2018/4/****.png?thumbnail/<Width>x<Height>
   * 1.2 /images/2018/4/****.png?thumbnail/<Width>x<Height>_[cover|contain|fill|inside|outside]
   * 1.3 /images/2018/4/****.jpeg?jpeg/75
   * 1.4 /images/2018/4/****.jpeg?jpeg/80_progressive
   * 1.5 /images/2018/4/****.jpeg?jpeg/80_progressive&thumbnail/<Width>x<Height>_[cover|contain|fill|inside|outside]
   * 2. /images/****.png?prefix=2018/4
   * @param {string} filename
   * @param thumbnailConfig
   * @param jpegConfig
   * @param {string} prefix
   * @param {string} bucket
   * @param res
   * @returns {Promise<void>}
   */
  @Get('images/*')
  async getImage(
    @Param('0') filename: string,
    @Query(ThumbnailPipe) thumbnailConfig: { opts: ThumbnailParam; param?: string },
    @Query(JpegPipe) jpegConfig: { opts: JpegParam; param?: string },
    @Query('prefix') prefix: string = '',
    @Query('bucket') bucket: string = 'default',
    @Res() res,
  ) {
    const fullFilePath = path.join(this.context.uploadPath, bucket, prefix, filename);
    if (fullFilePath.startsWith(this.context.uploadPath)) {
      return this.context.defaultStorageEngine.resolve(
        { filename, bucket, prefix, thumbnailConfig, jpegConfig },
        res,
      );
    }
  }

  @Get('videos/*')
  async getVideo(
    @Param('0') filename: string,
    @Query('prefix') prefix: string = '',
    @Query('bucket') bucket: string = 'videos',
    @Res() res,
  ) {
    const fullFilePath = path.join(this.context.uploadPath, bucket, prefix, filename);
    if (fullFilePath.startsWith(this.context.uploadPath)) {
      logger.log(`check if file '${fullFilePath}' exists`);
      if (!fsExtra.existsSync(fullFilePath)) {
        throw new NotFoundException();
      }
      res.sendFile(fullFilePath);
    } else {
      res.send();
    }
  }

  @Get('attaches/*')
  async getAttaches(
    @Param('0') filename: string,
    @Query('prefix') prefix: string = '',
    @Query('bucket') bucket: string = 'attaches',
    @Res() res,
  ) {
    const fullFilePath = path.join(this.context.uploadPath, bucket, prefix, filename);
    if (fullFilePath.startsWith(this.context.uploadPath)) {
      logger.log(`check if file '${fullFilePath}' exists`);
      if (!fsExtra.existsSync(fullFilePath)) {
        throw new NotFoundException();
      }
      res.sendFile(fullFilePath);
    } else {
      res.send();
    }
  }

  @Get('files/*')
  async getFiles(
    @Param('0') filename: string,
    @Query('prefix') prefix: string = '',
    @Query('bucket') bucket: string = 'files',
    @Res() res,
  ) {
    const fullFilePath = path.join(this.context.uploadPath, bucket, prefix, filename);
    if (fullFilePath.startsWith(this.context.uploadPath)) {
      logger.log(`check if file '${fullFilePath}' exists`);
      if (!fsExtra.existsSync(fullFilePath)) {
        throw new NotFoundException();
      }
      res.sendFile(fullFilePath);
      // return UploaderController.fileStorageEngine.resolve({ filename, bucket, prefix }, res);
    } else {
      res.send();
    }
  }
}
