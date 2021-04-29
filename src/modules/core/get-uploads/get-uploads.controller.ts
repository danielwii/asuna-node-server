import { Controller, Get, Header, Param, Query, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

import { LoggerFactory } from '@danielwii/asuna-helper/dist/logger';
import { r } from '@danielwii/asuna-helper/dist/serializer';

import { classToPlain } from 'class-transformer';

import { AsunaContext } from '../context';
import { FinderHelper } from '../finder';
import { JpegPipe, JpegPipeOptions } from '../image/jpeg.pipe';
import { ThumbnailPipe, ThumbnailPipeOptions } from '../image/thumbnail.pipe';

import type { Response } from 'express';

const logger = LoggerFactory.getLogger('GetUploadsController');

@ApiTags('core')
@Controller('uploads')
export class GetUploadsController {
  /**
   * 1. /images/2018/4/****.png
   * 1.1 /images/2018/4/****.png?thumbnail/<Width>x<Height>
   * 1.2 /images/2018/4/****.png?thumbnail/<Width>x<Height>_[cover|contain|fill|inside|outside]
   * 1.3 /images/2018/4/****.jpeg?jpeg/75
   * 1.4 /images/2018/4/****.jpeg?jpeg/80_progressive
   * 1.5 /images/2018/4/****.jpeg?jpeg/80_progressive&thumbnail/<Width>x<Height>_[cover|contain|fill|inside|outside]
   * 2. /images/****.png?prefix=2018/4
   * 3. /videos/****.mp4?prefix=2018/4
   * @param bucket
   * @param filename
   * @param internal 内部地址
   * @param param
   * @param query
   * @param thumbnailConfig
   * @param jpegConfig
   * @param res
   */
  @Header('Cache-Control', 'max-age=31536000') // expired in 1 year
  @Get(':bucket/*')
  async getUploads(
    @Param('bucket') bucket: string,
    @Param('0') filename: string,
    @Query('internal') internal: boolean,
    @Param() param: object,
    @Query() query: object,
    @Query(ThumbnailPipe) thumbnailConfig: ThumbnailPipeOptions,
    @Query(JpegPipe) jpegConfig: JpegPipeOptions,
    @Res() res: Response,
  ): Promise<void> {
    const storageEngine = AsunaContext.instance.getStorageEngine(bucket);
    logger.verbose(
      `get ${r({ bucket, filename })} by ${r({
        storageEngine: classToPlain(storageEngine),
        thumbnailConfig,
        jpegConfig,
        internal,
        query,
        param,
      })}`,
    );
    return storageEngine?.resolveUrl(
      {
        filename,
        bucket,
        thumbnailConfig,
        jpegConfig,
        query,
        resolver: (path) => FinderHelper.resolveUrl({ type: 'assets', path, internal }),
      },
      res,
    );
  }
}
