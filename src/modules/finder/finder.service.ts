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
      throw new AsunaException(AsunaCode.BadRequest, JSON.stringify({ type, name, path }));
    }

    const upstreams = await this.kvService.get(AsunaCollections.SYSTEM_SERVER, key);
    logger.log(`upstreams ${JSON.stringify(upstreams)}`);
    if (!(upstreams && upstreams.value && _.isObject(upstreams.value))) {
      logger.warn(`${name || 'default'} not available in upstream ${key}`);
      throw new AsunaException(
        AsunaCode.Unprocessable,
        `${name || 'default'} not available in upstream ${key}`,
      );
    }

    if (type === 'assets') {
      const upstream = upstreams.value[name || 'default'];
      const finderAssetsSettings = plainToClass(FinderAssetsSettings, upstream);
      if (!finderAssetsSettings) {
        throw new AsunaException(
          AsunaCode.Unprocessable,
          `invalid upstream ${JSON.stringify(upstream)}`,
        );
      }
      const errors = await validate(finderAssetsSettings);
      if (errors.length) {
        throw new AsunaException(
          AsunaCode.Unprocessable,
          `invalid settings ${JSON.stringify(errors)}`,
        );
      }
      const resourcePath = urljoin('/', path).replace(/\/+/g, '/');
      const portStr = upstream.port ? `:${upstream.port}` : '';

      // get same domain if hostname startswith /
      if (_.startsWith(upstream.hostname, '/')) {
        return `${upstream.hostname}${portStr}${resourcePath}`;
      }

      return `${upstream.protocol || 'https'}://${upstream.hostname}${portStr}${resourcePath}`;
    } else {
      // TODO add other handlers later
      logger.warn('only type assets is available');
      throw new AsunaException(AsunaCode.InvalidParameter, 'only type assets is available');
    }
  }
}
