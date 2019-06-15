import { AsunaCollections, KvService } from '../core/kv';
import { Injectable, Logger } from '@nestjs/common';
import * as _ from 'lodash';
import { plainToClass } from 'class-transformer';
import { validate } from 'class-validator';
import { FinderAssetsSettings } from './finder.controller';
import { AsunaCode, AsunaException } from '../core/base';
import urljoin = require('url-join');

const logger = new Logger('FinderService');

@Injectable()
export class FinderService {
  constructor(private readonly kvService: KvService) {}

  async getUrl(key: string, type: 'assets' | 'zones', name: string, path: string) {
    if (!(key && type && path)) {
      throw new AsunaException(
        AsunaCode.UNPROCESSABLE_ENTITY,
        JSON.stringify({ type, name, path }),
      );
    }

    const upstreams = await this.kvService.get(AsunaCollections.SYSTEM_SERVER, key);
    logger.log(`upstreams ${JSON.stringify(upstreams)}`);
    if (!(upstreams && upstreams.value && _.isObject(upstreams.value))) {
      logger.warn(`${name || 'default'} not available in upstream ${key}`);
      throw new AsunaException(
        AsunaCode.INTERNAL,
        `${name || 'default'} not available in upstream ${key}`,
      );
    }

    if (type === 'assets') {
      const upstream = upstreams.value[name || 'default'];
      const finderAssetsSettings = plainToClass(FinderAssetsSettings, upstream);
      if (!finderAssetsSettings) {
        throw new AsunaException(
          AsunaCode.INTERNAL,
          `invalid upstream ${JSON.stringify(upstream)}`,
        );
      }
      const errors = await validate(finderAssetsSettings);
      if (errors.length) {
        throw new AsunaException(AsunaCode.INTERNAL, `invalid settings ${JSON.stringify(errors)}`);
      }
      return `${upstream.protocol || 'https'}://${urljoin(upstream.hostname, path)}`;
    } else {
      // TODO add other handlers later
      logger.warn('only type assets is available');
      throw new AsunaException(AsunaCode.INTERNAL, 'only type assets is available');
    }
  }
}
