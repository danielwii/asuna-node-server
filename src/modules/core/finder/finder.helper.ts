import { Promise } from 'bluebird';
import { IsOptional, IsString } from 'class-validator';
import { join } from 'path';
import * as url from 'url';
import { AsunaErrorCode, AsunaException, deserializeSafely, LoggerFactory, r } from '../../common';
import { AsunaCollections, KvDef, KvHelper } from '../kv';

const logger = LoggerFactory.getLogger('FinderHelper');

export type HostExchange = { regex: string; endpoint: string };

export enum FinderFieldKeys {
  endpoint = 'endpoint',
  internalEndpoint = 'internal-endpoint',
  hostExchanges = 'host-exchanges',
}

export class FinderAssetsSettings {
  @IsString() @IsOptional() endpoint?: string;
  @IsString() @IsOptional() internalEndpoint?: string;

  @IsOptional() hostExchanges?: string;
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
    const defaultEndpoint = internal ? config.internalEndpoint : config.endpoint;
    logger.verbose(`get endpoint ${r({ type, internal, config, defaultEndpoint })}`);

    if (!defaultEndpoint) {
      logger.warn(`${name ?? 'default'} not available in upstream ${defaultEndpoint}`);
      throw new AsunaException(
        AsunaErrorCode.Unprocessable,
        `${name ?? 'default'} not available in upstream ${defaultEndpoint}`,
      );
    }

    // const resourcePath = join('/', path).replace(/\/+/g, '/');
    if (config.hostExchanges) {
      try {
        const exchanges: HostExchange[] = JSON.parse(config.hostExchanges);
        logger.verbose(`parse exchanges ${r({ exchanges })}`);
        const exchange = exchanges.find((x) => new RegExp(x.regex).test(path));
        if (exchange) {
          logger.verbose(`check exchange ${r({ exchange, path })}`);
          return url.resolve(`${exchange.endpoint ?? ''}/`, path);
        }
      } catch (e) {
        logger.error(`handle exchange error: ${e}`);
      }
    }

    if (type === 'assets') {
      return url.resolve(`${config.endpoint ?? ''}/`, path);
    }
    // TODO add other handlers later
    logger.warn('only type assets is available');
    throw new AsunaException(AsunaErrorCode.InvalidParameter, 'only type assets is available');
  }
}
