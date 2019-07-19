import { ArgumentMetadata, Injectable, PipeTransform } from '@nestjs/common';
import * as _ from 'lodash';
import * as fp from 'lodash/fp';
import { r } from '../../common/helpers';
import { LoggerFactory } from '../../logger';

const logger = LoggerFactory.getLogger('JpegPipe');

export interface JpegParam {
  quality?: number;
  progressive?: boolean;
}

export type JpegPipeOptions = { opts: JpegParam; param?: string };

/**
 * jpeg 专用的配置信息处理器
 */
@Injectable()
export class JpegPipe implements PipeTransform {
  async transform(value, { metatype }: ArgumentMetadata) {
    const param = _.find(_.keys(value), fp.startsWith('jpeg/'));
    if (!param) {
      return {};
    }
    const jpegParam: JpegParam = { progressive: true, quality: 75 };
    try {
      if (param.includes('/')) {
        const params = param.split('/')[1].split('_');
        [jpegParam.quality, jpegParam.progressive] = [
          +params[0] || 75,
          !(params[1] === 'baseline'),
        ];
        logger.log(r({ value, metatype, param, params, jpegParam }));
        return { opts: jpegParam, param };
      }
    } catch (e) {
      logger.warn(r(e));
      return { opts: jpegParam, param };
    }
    return {}; // for default
  }
}
