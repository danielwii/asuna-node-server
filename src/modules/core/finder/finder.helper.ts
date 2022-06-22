import { Logger } from '@nestjs/common';

import { ConfigKeys } from '@danielwii/asuna-helper/dist/config';
import { AsunaErrorCode, AsunaException } from '@danielwii/asuna-helper/dist/exceptions';
import { r } from '@danielwii/asuna-helper/dist/serializer';
import { deserializeSafely } from '@danielwii/asuna-helper/dist/validate';

import { IsOptional } from 'class-validator';
import { URL } from 'url';

import { configLoader } from '../../config';
import { resolveModule } from '@danielwii/asuna-helper/dist/logger/factory';
import { AsunaCollections, KvDef, KvHelper } from '../kv';

const logger = new Logger(resolveModule(__filename, 'FinderHelper'));

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
    isCN,
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
    isCN?: boolean;
  }): Promise<string> {
    if (!(type && path)) {
      throw new AsunaException(AsunaErrorCode.BadRequest, JSON.stringify({ type, name, path }));
    }

    const config = await this.getConfig();
    const defaultAssetsEndpoint = configLoader.loadConfig(ConfigKeys.ASSETS_ENDPOINT);
    const defaultCNAssetsEndpoint = configLoader.loadConfig(ConfigKeys.ASSETS_ENDPOINT + '_CN', defaultAssetsEndpoint);
    const endpoint = internal
      ? /* config.internalEndpoint ?? */ configLoader.loadConfig(ConfigKeys.ASSETS_INTERNAL_ENDPOINT)
      : /* config.endpoint ?? */ isCN
      ? defaultCNAssetsEndpoint
      : defaultAssetsEndpoint;
    logger.verbose(
      `get endpoint ${r({ type, internal, config, endpoint, defaultAssetsEndpoint, defaultCNAssetsEndpoint })}`,
    );

    if (!endpoint) {
      logger.warn(`${name ?? 'default'} not available in upstream endpoint ${endpoint}`);
      throw new AsunaException(
        AsunaErrorCode.Unprocessable,
        `${name ?? 'default'} not available in upstream endpoint ${endpoint}`,
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
          return new URL(path, `${exchange.endpoint ?? ''}/`).toString();
        }
      } catch (e) {
        logger.error(`handle exchange error: ${e}`);
      }
    }

    if (type === 'assets') {
      return new URL(path, `${endpoint ?? ''}/`).toString();
    }
    // TODO add other handlers later
    logger.warn('only type assets is available');
    throw new AsunaException(AsunaErrorCode.InvalidParameter, 'only type assets is available');
  }
}
