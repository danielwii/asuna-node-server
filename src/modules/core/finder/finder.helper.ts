import { IsString } from 'class-validator';
import * as _ from 'lodash';
import { join } from 'path';
import { AsunaErrorCode, AsunaException, deserializeSafely, LoggerFactory } from '../../common';
import { AsunaCollections, KvDef, KVField, KVGroupFieldsValue, KvHelper } from '../kv';

const logger = LoggerFactory.getLogger('FinderHelper');

export enum FinderFieldKey {
  endpoint = 'endpoint',
  internalEndpoint = 'internal-endpoint',
}

export class FinderAssetsSettings {
  @IsString() endpoint: string;
}

export class FinderHelper {
  static kvDef: KvDef = { collection: AsunaCollections.SYSTEM_SERVER, key: 'settings.finder.assets' };

  static async getValueByFieldKV(fieldKey: FinderFieldKey): Promise<string> {
    const field = await this.getByFieldKV(fieldKey);
    return field ? ((field.value || field.field.defaultValue) as string) : null;
  }

  private static async getByFieldKV(fieldKey: FinderFieldKey): Promise<{ field: KVField; value: string }> {
    const fields: KVGroupFieldsValue = (await KvHelper.get(this.kvDef.collection, this.kvDef.key)).value;
    return {
      value: fields.values[fieldKey],
      field: _.get(
        _.chain(fields.form)
          .flatMap(fieldGroup => fieldGroup.fields)
          .find(fieldDef => fieldDef.field.name === fieldKey)
          .value(),
        'field',
      ),
    };
  }

  static async getUrl({
    type,
    name,
    path,
    internal,
  }: {
    type: 'assets' | 'zones';
    name?: string; // default is default
    path: string;
    internal?: boolean;
  }): Promise<string> {
    if (!(type && path)) {
      throw new AsunaException(AsunaErrorCode.BadRequest, JSON.stringify({ type, name, path }));
    }

    const endpoint = internal
      ? await this.getValueByFieldKV(FinderFieldKey.internalEndpoint)
      : await this.getValueByFieldKV(FinderFieldKey.endpoint);
    logger.debug(`endpoint ${endpoint}`);

    if (!endpoint) {
      logger.warn(`${name || 'default'} not available in upstream ${endpoint}`);
      throw new AsunaException(
        AsunaErrorCode.Unprocessable,
        `${name || 'default'} not available in upstream ${endpoint}`,
      );
    }

    if (type === 'assets') {
      // const upstream = upstreams.value[`${internal ? 'internal-' : ''}${name || 'default'}`];
      const finderAssetsSettings = deserializeSafely(FinderAssetsSettings, { endpoint });
      if (!finderAssetsSettings) {
        throw new AsunaException(
          AsunaErrorCode.Unprocessable,
          `invalid upstream ${JSON.stringify(endpoint)} for finder`,
        );
      }
      const resourcePath = join('/', path).replace(/\/+/g, '/');
      /* const portStr = upstream.port ? `:${upstream.port}` : '';

      // get same domain if hostname startswith /
      if (_.startsWith(upstream.hostname, '/')) {
        return `${upstream.endpoint}${resourcePath}`;
      }
*/
      return `${finderAssetsSettings.endpoint || ''}${resourcePath}`;
    }
    // TODO add other handlers later
    logger.warn('only type assets is available');
    throw new AsunaException(AsunaErrorCode.InvalidParameter, 'only type assets is available');
  }
}
