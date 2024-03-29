import { ArgumentMetadata, Injectable, Logger, PipeTransform } from '@nestjs/common';

import { r } from '@danielwii/asuna-helper/dist/serializer';

import _ from 'lodash';
import fp from 'lodash/fp';

export interface JpegParam {
  quality?: number;
  progressive?: boolean;
}

export interface JpegPipeOptions {
  opts?: JpegParam;
  param?: string;
}

/**
 * jpeg 专用的配置信息处理器
 */
@Injectable()
export class JpegPipe implements PipeTransform {
  async transform(value, { metatype }: ArgumentMetadata): Promise<JpegPipeOptions> {
    const param = _.find(_.keys(value), fp.startsWith('jpeg/'));
    if (!param) {
      return {};
    }
    const jpegParam: JpegParam = { progressive: true, quality: 75 };
    try {
      if (param.includes('/')) {
        const params = param.split('/')[1].split('_');
        [jpegParam.quality, jpegParam.progressive] = [Number(params[0]) || 75, !(params[1] === 'baseline')];
        Logger.log(r({ value, metatype, param, params, jpegParam }));
        return { opts: jpegParam, param };
      }
    } catch (error) {
      Logger.warn(r(error));
      return { opts: jpegParam, param };
    }
    return {}; // for default
  }
}
