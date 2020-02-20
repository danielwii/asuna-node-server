import { Promise } from 'bluebird';
import { IsOptional, IsString } from 'class-validator';
import { join } from 'path';
import { AsunaErrorCode, AsunaException, deserializeSafely, LoggerFactory, r } from '../../common';
import { AsunaCollections, KvDef, KvHelper } from '../kv';

const logger = LoggerFactory.getLogger('FinderHelper');

export enum FinderFieldKeys {
  endpoint = 'endpoint',
  internalEndpoint = 'internal-endpoint',
}

export class FinderAssetsSettings {
  @IsString() @IsOptional() endpoint?: string;
  @IsString() @IsOptional() internalEndpoint?: string;
}

export class FinderHelper {
  static kvDef: KvDef = { collection: AsunaCollections.SYSTEM_SERVER, key: 'settings.finder.assets' };

  static async getConfig(): Promise<FinderAssetsSettings> {
    return deserializeSafely(FinderAssetsSettings, await KvHelper.getConfigsByEnumKeys(this.kvDef, FinderFieldKeys));
  }

  static async resolveUrl({
    type,
    name,
    path,
    internal,
  }: {
    type: /**
     * 直接附件查询，默认模式
     */
    | 'assets'
      /**
       * 按区域查询
       */
      | 'zones';
    name?: string; // default is default
    path: string;
    internal?: boolean;
  }): Promise<string> {
    if (!(type && path)) {
      throw new AsunaException(AsunaErrorCode.BadRequest, JSON.stringify({ type, name, path }));
    }

    const config = await this.getConfig();
    const endpoint = internal ? config.internalEndpoint : config.endpoint;
    logger.debug(`get endpoint ${r({ internal, config, endpoint })}`);

    if (!endpoint) {
      logger.warn(`${name || 'default'} not available in upstream ${endpoint}`);
      throw new AsunaException(
        AsunaErrorCode.Unprocessable,
        `${name || 'default'} not available in upstream ${endpoint}`,
      );
    }

    if (type === 'assets') {
      /*
      if (!config) {
        throw new AsunaException(
          AsunaErrorCode.Unprocessable,
          `invalid upstream ${JSON.stringify(endpoint)} for finder`,
        );
      }
*/
      const resourcePath = join('/', path).replace(/\/+/g, '/');
      return `${config.endpoint || ''}${resourcePath}`;
    }
    // TODO add other handlers later
    logger.warn('only type assets is available');
    throw new AsunaException(AsunaErrorCode.InvalidParameter, 'only type assets is available');
  }
}
