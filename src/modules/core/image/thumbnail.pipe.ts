import { ArgumentMetadata, Injectable, Logger, PipeTransform } from '@nestjs/common';

import { r } from '@danielwii/asuna-helper/dist/serializer';

import _ from 'lodash';
import * as fp from 'lodash/fp';

import { resolveModule } from '@danielwii/asuna-helper/dist/logger/factory';

import type { FitEnum } from 'sharp';

const logger = new Logger(resolveModule(__filename, 'ThumbnailPipe'));

export interface ThumbnailParam {
  width?: number;
  height?: number;
  fit?: keyof FitEnum;
  format?: 'webp';
}

export interface ThumbnailPipeOptions {
  opts?: ThumbnailParam;
  param?: string;
}

@Injectable()
export class ThumbnailPipe implements PipeTransform {
  async transform(value: any, { metatype }: ArgumentMetadata): Promise<ThumbnailPipeOptions> {
    const param = _.find(_.keys(value), fp.startsWith('thumbnail/'));
    const thumbnail: ThumbnailParam = {};
    if (!param) {
      return {};
    }
    try {
      if (param.includes('/')) {
        const format = param.split('/')[1].split('.')[1];
        const params = param.split('/')[1].split('.')[0].split('_');
        thumbnail.fit = ['cover', 'contain', 'fill', 'inside', 'outside'].includes(params[1])
          ? (params[1] as any)
          : null;
        thumbnail.format = format as any;
        [thumbnail.width, thumbnail.height] = params[0].split('x').map((val) => (val ? _.toNumber(val) : null));
        logger.log(r({ value, metatype, param, params, thumbnail }));
        return { opts: thumbnail, param };
      }
    } catch (error) {
      logger.warn(r(error));
      return { opts: thumbnail, param };
    }
    return {};
  }
}
