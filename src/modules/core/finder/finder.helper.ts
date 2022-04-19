import { ConfigKeys } from '@danielwii/asuna-helper/dist/config';
import { AsunaErrorCode, AsunaException } from '@danielwii/asuna-helper/dist/exceptions';
import { LoggerFactory } from '@danielwii/asuna-helper/dist/logger/factory';
import { r } from '@danielwii/asuna-helper/dist/serializer';
import { deserializeSafely } from '@danielwii/asuna-helper/dist/validate';

import { IsOptional, IsString } from 'class-validator';
import * as url from 'url';

import { configLoader } from '../../config';
import { AsunaCollections, KvDef, KvHelper } from '../kv';

const logger = LoggerFactory.getLogger('FinderHelper');

export interface HostExchange {
  regex: string;
  endpoint: string;
}

export enum FinderFieldKeys {
  endpoint = 'endpoint',
  internalEndpoint = 'internal-endpoint',
  hostExchanges = 'host-exchanges',
}

export class FinderAssetsSettings {
  // @IsString() @IsOptional() public endpoint?: string;
  // @IsString() @IsOptional() public internalEndpoint?: string;

  @IsOptional() public hostExchanges?: string;
}

export class FinderHelper {
  public static kvDef: KvDef = { collection: AsunaCollections.SYSTEM_SERVER, key: 'settings.finder.assets' };

  public static async getConfig(): Promise<FinderAssetsSettings> {
    return deserializeSafely(FinderAssetsSettings, await KvHelper.getConfigsByEnumKeys(this.kvDef, FinderFieldKeys));
  }

  public static async resolveUrl({
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
    const defaultEndpoint = internal
      ? /*config.internalEndpoint ??*/ configLoader.loadConfig(ConfigKeys.ASSETS_INTERNAL_ENDPOINT)
      : /*config.endpoint ??*/ configLoader.loadConfig(ConfigKeys.ASSETS_ENDPOINT);
    logger.verbose(`get endpoint ${r({ type, internal, config, defaultEndpoint })}`);

    if (!defaultEndpoint) {
      logger.warn(`${name ?? 'default'} not available in upstream endpoint ${defaultEndpoint}`);
      throw new AsunaException(
        AsunaErrorCode.Unprocessable,
        `${name ?? 'default'} not available in upstream endpoint ${defaultEndpoint}`,
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
      return new URL(path, `${defaultEndpoint ?? ''}/`).toString();
    }
    // TODO add other handlers later
    logger.warn('only type assets is available');
    throw new AsunaException(AsunaErrorCode.InvalidParameter, 'only type assets is available');
  }
}
