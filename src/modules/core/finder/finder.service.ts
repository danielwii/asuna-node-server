import { Injectable } from '@nestjs/common';
import { validate } from 'class-validator';
import * as _ from 'lodash';
import { join } from 'path';
import { AsunaError, AsunaException, deserializeSafely, r } from '../../common';
import { AsunaCollections, KvService } from '../kv';
import { LoggerFactory } from '../../logger';
import { FinderAssetsSettings } from './finder.controller';

const logger = LoggerFactory.getLogger('FinderService');

@Injectable()
export class FinderService {
  constructor(private readonly kvService: KvService) {}

  async getUrl({
    key,
    type,
    name,
    path,
    internal,
  }: {
    key: string;
    type: 'assets' | 'zones';
    name?: string; // default is default
    path: string;
    internal?: boolean;
  }) {
    if (!(key && type && path)) {
      throw new AsunaException(AsunaError.BadRequest, JSON.stringify({ type, name, path }));
    }

    const upstreams = await this.kvService.get(AsunaCollections.SYSTEM_SERVER, key);
    logger.debug(`upstreams ${r(upstreams)}`);
    if (!(upstreams && upstreams.value && _.isObject(upstreams.value))) {
      logger.warn(`${name || 'default'} not available in upstream ${key}`);
      throw new AsunaException(
        AsunaError.Unprocessable,
        `${name || 'default'} not available in upstream ${key}`,
      );
    }

    if (type === 'assets') {
      const upstream = upstreams.value[`${internal ? 'internal-' : ''}${name || 'default'}`];
      const finderAssetsSettings = deserializeSafely(FinderAssetsSettings, upstream);
      if (!finderAssetsSettings) {
        throw new AsunaException(
          AsunaError.Unprocessable,
          `invalid upstream ${JSON.stringify(upstream)} for finder`,
        );
      }
      const errors = await validate(finderAssetsSettings);
      if (errors.length) {
        throw new AsunaException(
          AsunaError.Unprocessable,
          `invalid settings ${JSON.stringify(errors)} for finder`,
        );
      }
      const resourcePath = join('/', path).replace(/\/+/g, '/');
      /*const portStr = upstream.port ? `:${upstream.port}` : '';

      // get same domain if hostname startswith /
      if (_.startsWith(upstream.hostname, '/')) {
        return `${upstream.endpoint}${resourcePath}`;
      }
*/
      return `${upstream.endpoint}${resourcePath}`;
    } else {
      // TODO add other handlers later
      logger.warn('only type assets is available');
      throw new AsunaException(AsunaError.InvalidParameter, 'only type assets is available');
    }
  }
}
