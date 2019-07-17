import { ArgumentMetadata, Injectable, Logger, PipeTransform } from '@nestjs/common';
import * as _ from 'lodash';
import * as fp from 'lodash/fp';
import { FitEnum } from 'sharp';
import * as util from 'util';

const logger = new Logger('ThumbnailPipe');

export interface ThumbnailParam {
  width?: number;
  height?: number;
  fit?: keyof FitEnum;
}

export type ThumbnailPipeOptions = { opts: ThumbnailParam; param?: string };

@Injectable()
export class ThumbnailPipe implements PipeTransform {
  async transform(value: any, { metatype }: ArgumentMetadata) {
    const param = _.find(_.keys(value), fp.startsWith('thumbnail/'));
    const thumbnail: ThumbnailParam = {};
    if (!param) {
      return thumbnail;
    }
    try {
      if (param.includes('/')) {
        const params = param.split('/')[1].split('_');
        thumbnail.fit = ['cover', 'contain', 'fill', 'inside', 'outside'].includes(params[1])
          ? (params[1] as any)
          : null;
        [thumbnail.width, thumbnail.height] = params[0]
          .split('x')
          .map(val => (val ? _.toNumber(val) : null));
        logger.log(util.inspect({ value, metatype, param, thumbnail }, { colors: true }));
        return { opts: thumbnail, param };
      }
    } catch (e) {
      logger.warn(e.message);
      return { opts: thumbnail, param };
    }
    return {};
  }
}
