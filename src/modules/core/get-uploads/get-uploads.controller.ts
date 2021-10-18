import { Controller, Get, Header, Param, Query, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

import { LoggerFactory } from '@danielwii/asuna-helper/dist/logger/factory';
import { r } from '@danielwii/asuna-helper/dist/serializer';

import { classToPlain } from 'class-transformer';
import crypto from 'crypto';
import _ from 'lodash';

import { CacheWrapper } from '../../cache';
import { TimeUnit } from '../../common';
import { AsunaContext } from '../context';
import { FinderHelper } from '../finder';
import { BlurredHelper } from '../image/blurred.helper';
import { JpegPipe, JpegPipeOptions } from '../image/jpeg.pipe';
import { ThumbnailPipe, ThumbnailPipeOptions } from '../image/thumbnail.pipe';
import { LocalStorage } from '../storage';

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
  public async getUploads(
    @Param('bucket') bucket: string,
    @Param('0') filename: string,
    @Query('internal') internal: boolean,
    // @Query('blurred') blurred: any,
    @Param() param: object,
    @Query() query: object,
    @Query(ThumbnailPipe) thumbnailConfig: ThumbnailPipeOptions,
    @Query(JpegPipe) jpegConfig: JpegPipeOptions,
    @Res() res: Response,
  ): Promise<void> {
    const storageEngine = AsunaContext.instance.getStorageEngine(bucket);
    const engine = classToPlain(storageEngine);
    const blurred = _.has(query, 'blurred');
    logger.verbose(
      `get ${r({ bucket, filename })} by ${r({
        engine,
        thumbnailConfig,
        jpegConfig,
        internal,
        query,
        param,
        blurred,
      })}`,
    );
    const resolver = (path: string) => FinderHelper.resolveUrl({ type: 'assets', path, internal });
    if (blurred) {
      const hash = crypto.createHash('md5');
      hash.update('', 'utf8');
      const key = hash.digest('hex');

      if (storageEngine instanceof LocalStorage) {
        const filepath = await new Promise<string>((resolve) => {
          storageEngine?.resolveUrl({ filename, bucket, thumbnailConfig, jpegConfig, query, resolver }, {
            type: () => ({ sendFile: resolve }),
          } as any);
        });
        const blurhash = await CacheWrapper.do({
          prefix: 'blurred-',
          key,
          expiresInSeconds: TimeUnit.DAYS.toSeconds(7),
          resolver: () => BlurredHelper.encodeImageToBlurhash(filepath),
        });
        logger.verbose(`get blurred image ${r({ bucket, filename })}: ${blurhash}`);
        res.send(blurhash);
        return;
      }
      res.send('not implemented blurred engine.');
      return;
    }
    return storageEngine?.resolveUrl({ filename, bucket, thumbnailConfig, jpegConfig, query, resolver }, res);
  }
}
