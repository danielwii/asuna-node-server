import { Controller, Get, Header, Logger, Param, Query, Req, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

import { r } from '@danielwii/asuna-helper/dist/serializer';

import { instanceToPlain } from 'class-transformer';
import crypto from 'crypto';
import geoip from 'geoip-lite';
import _ from 'lodash';
import path from 'path';

import { CacheWrapper } from '../../cache';
import { TimeUnit } from '../../common';
import { configLoader } from '../../config';
import { resolveModule } from '@danielwii/asuna-helper/dist/logger/factory';
import { AsunaContext } from '../context';
import { FinderHelper } from '../finder';
import { BlurredHelper } from '../image/blurred.helper';
import { JpegPipe, JpegPipeOptions } from '../image/jpeg.pipe';
import { ThumbnailPipe, ThumbnailPipeOptions } from '../image/thumbnail.pipe';
import { LocalStorage } from '../storage';

import type { RequestInfo } from '../../helper';
import type { Response } from 'express';

const logger = new Logger(resolveModule(__filename, 'GetUploadsController'));

class ImageProxy {
  private static readonly filterRegexp = /(.+)\((.*)\)/;
  private static readonly regexp = new RegExp(
    [
      '/?',
      // unsafe
      '((unsafe/)|(([A-Za-z0-9-_]{26,28})[=]{0,2})/)?',
      // meta
      '(meta/)?',
      // trim
      '(trim(:(top-left|bottom-right))?(:(\\d+))?/)?',
      // crop
      '((\\d+)x(\\d+):(\\d+)x(\\d+)/)?',
      // fit-in
      '(fit-in/)?',
      // dimensions
      '((\\-?)(\\d*)x(\\-?)(\\d*)/)?',
      // halign
      '((left|right|center)/)?',
      // valign
      '((top|bottom|middle)/)?',
      // smart
      '(smart/)?',
      // filters
      '(filters:(.+?\\))\\/)?',
      // image
      '(.+)?',
    ].join(''),
  );

  public static parse(url) {
    const results = {
      image: '',
      crop: { left: null, top: null, right: null, bottom: null },
      width: null,
      height: null,
      meta: false,
      horizontalFlip: false,
      verticalFlip: false,
      halign: null,
      valign: null,
      smart: false,
      fitIn: false,
      filters: null,
      trim: { orientation: null, tolerance: null },
      unsafe: false,
      hash: null,
    };

    const match = url.match(ImageProxy.regexp);
    let index = 1;

    if (match[index]) {
      if (match[index + 1] === 'unsafe/') {
        results.unsafe = true;
      } else {
        results.hash = match[index + 2].length > 28 ? null : match[index + 3];
      }
    }

    index = index + 4;

    if (match[index]) {
      results.meta = true;
    }
    index++;

    if (match[index]) {
      results.trim.orientation = match[index + 2] || 'top-left';
      results.trim.tolerance = (match[index + 4] && parseInt(match[index + 4], 10)) || 0;
    }
    index = index + 5;

    if (match[index]) {
      results.crop.left = parseInt(match[index + 1], 10);
      results.crop.top = parseInt(match[index + 2], 10);
      results.crop.right = parseInt(match[index + 3], 10);
      results.crop.bottom = parseInt(match[index + 4], 10);
    }
    index = index + 5;

    if (match[index]) {
      results.fitIn = true;
    }
    index++;

    if (match[index]) {
      results.horizontalFlip = !!match[index + 1];
      if (match[index + 2]) {
        results.width = Math.abs(parseInt(match[index + 2], 10));
      }
      results.verticalFlip = !!match[index + 3];
      if (match[index + 4]) {
        results.height = Math.abs(parseInt(match[index + 4], 10));
      }
    }
    index = index + 5;

    if (match[index]) {
      results.halign = match[index + 1];
    }
    index = index + 2;

    if (match[index]) {
      results.valign = match[index + 1];
    }
    index = index + 2;

    if (match[index]) {
      results.smart = true;
    }
    index++;

    if (match[index]) {
      results.filters = this.parseFilters(match[index + 1]);
    }

    index = index + 2;

    results.image = match[index];

    return results;
  }

  public static parseFilters(filters) {
    return filters.split(':').map((filter) => {
      const match = filter.match(ImageProxy.filterRegexp);
      return {
        name: match[1],
        args: match[2].split(',').filter(Boolean),
      };
    });
  }
}

@ApiTags('core')
@Controller('i')
export class GetImageController {
  private readonly apiEndpoint = configLoader.loadConfig('MASTER_ADDRESS');
  private readonly thumborEndpoint = configLoader.loadConfig('THUMBOR_ENDPOINT', 'http://localhost:8888');

  @Header('Cache-Control', 'max-age=31536000') // expired in 1 year
  @Get(':bucket/*')
  public async get(@Param('bucket') bucket: string, @Param('0') url: string, @Res() res: Response) {
    const filename = path.basename(url);
    const parsed = ImageProxy.parse(url);
    const parsedUrl = parsed.image.startsWith('uploads')
      ? url.replace(parsed.image, `${this.apiEndpoint}/${parsed.image}`)
      : url;
    const ext = path.extname(parsed.image);
    const redirectTo =
      ext === '.gif'
        ? parsed.image.startsWith('http')
          ? parsed.image
          : `/${parsed.image}`
        : `${this.thumborEndpoint}/${bucket}/${parsedUrl}`;
    logger.verbose(
      `get ${r({ bucket, filename: url })} by ${r({
        bucket,
        filename,
        url,
        parsedUrl,
        redirectTo,
        image: parsed.image,
        ext,
      })}`,
    );
    return res.redirect(redirectTo);
  }
}

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
   * @param req
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
    @Req() req: RequestInfo,
    @Res() res: Response,
  ): Promise<void> {
    const storageEngine = AsunaContext.instance.getStorageEngine(bucket);
    const engine = instanceToPlain(storageEngine);
    const blurred = _.has(query, 'blurred');
    const lookup = geoip.lookup(req.clientIp);
    const usingCN = lookup === null || lookup?.country === 'CN';
    logger.verbose(
      `get ${r({ bucket, filename })} by ${r({
        engine,
        thumbnailConfig,
        jpegConfig,
        internal,
        query,
        param,
        blurred,
        lookup,
        usingCN,
      })}`,
    );
    const resolver = (path: string) => FinderHelper.resolveUrl({ type: 'assets', path, internal, isCN: usingCN });
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
