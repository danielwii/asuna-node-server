import { Promise } from 'bluebird';
import { IsString } from 'class-validator';
import * as _ from 'lodash';
import * as fp from 'lodash/fp';
import { CacheUtils } from '../../cache';
import { CacheWrapper } from '../../cache/wrapper';
import {
  AsunaErrorCode,
  AsunaException,
  deserializeSafely,
  IdentifierHelper,
  r,
  StaticImplements,
  ValidationException,
} from '../../common';
import { LoggerFactory } from '../../common/logger';
import { EnumValueStatic } from '../../enum-values';
import { auth } from '../../helper';
import { AdminUser } from '../auth/auth.entities';
import { AdminUserIdentifierHelper } from '../auth/identifier';
import { KeyValueModel, KeyValuePair, KeyValueType, KVModelFormatType } from './kv.entities';

const logger = LoggerFactory.getLogger('KvHelper');

const castToBoolean = (value): boolean => value === 'true';
const isJson = (value): boolean => {
  try {
    JSON.parse(value);
    return true;
  } catch (error) {
    return false;
  }
};
const toJson = (value): JSON => {
  try {
    return JSON.parse(value);
  } catch (error) {
    logger.error(`${r({ value })} toJson error: ${r(error)}`);
    return value;
  }
};

export type KVField = {
  name: string;
  type: 'number' | 'string' | 'text' | 'json' | 'wx-subscribe-data' | 'wx-tmpl-data' | 'email-tmpl-data' | 'boolean';
  help?: string;
  required?: boolean;
  defaultValue?: boolean | number | string;
};

export interface KVFieldsList<V> {
  type: string;
  fields: { name?: string; field: KVField }[];
  values: V[];
}

export interface KVFields {
  [key: string]: {
    name: string;
    field: KVField;
  };
}

export interface KVGroupFields {
  [groupKey: string]: {
    name?: string;
    fields: {
      /**
       * name 在整个 KVGroupFields 中必须唯一
       */
      name: string;
      field: KVField;
    }[];
  };
}

export interface KVGroupFieldsValue {
  form?: KVGroupFields;
  values: { [key: string]: any };
}

export function recognizeTypeValue(type: KeyValueType, value: any): [KeyValueType, string] {
  let newType = type;
  let newValue = value;
  if (type) {
    if (Object.values(KeyValueType).includes(type)) {
      if (type === KeyValueType.boolean) {
        newValue = castToBoolean(value);
      } else if (type === KeyValueType.number) {
        newValue = +value;
      } else if (['json', 'images', 'videos'].includes(type)) {
        newValue = _.isString(value) ? toJson(value) : value;
      }
    }
  } else if (value === 'true' || value === 'false') {
    newType = KeyValueType.boolean;
    newValue = castToBoolean(value);
  } else if (!_.isNaN(+value)) {
    newType = KeyValueType.number;
    newValue = +value;
  } else if (isJson(value)) {
    newType = KeyValueType.json;
    newValue = toJson(value);
  }
  // logger.log(`recognizeTypeValue ${r({ type, value, newType, newValue })}`);
  return [newType || KeyValueType.string, newValue];
}

export enum AsunaColletionPrefix {
  // 限制只有管理员可以访问该前缀的 kv
  SYSTEM = 'SYSTEM',
  // 目前不限制权限
  APP = 'APP',
}

export const AsunaCollections = {
  SYSTEM_MIGRATIONS: 'system.migrations',
  SYSTEM_EMAIL: 'system.email',
  SYSTEM_SERVER: 'system.server',
  SYSTEM_WECHAT: 'system.wechat',
  SYSTEM_DYNAMIC_ROUTER: 'system.dynamic-router',
  SYSTEM_TENANT: 'system.tenant',
  APP_SETTINGS: 'app.settings',
};

export class KvDef {
  @IsString() collection: string;
  @IsString() key: string;

  constructor(o: KvDef) {
    Object.assign(this, deserializeSafely(KvDef, o));
  }
}

@StaticImplements<IdentifierHelper<KvDef>>()
export class KvDefIdentifierHelper {
  static parse = (identifier: string): KvDef => ({
    collection: identifier.split('#')[0],
    key: identifier.split('#')[1],
  });

  static stringify = (payload: KvDef): string => `${payload.collection}#${payload.key}`;
}

export type ConstantsKeys = 'WXMessageIds';

export class KvHelper {
  static initializers: { [key: string]: () => Promise<KeyValuePair> } = {};
  // static registerForms: { [identifier: string]: any } = {};
  // static constantMaps: { [key: string]: { [name: string]: string } } = {};
  static constantKvDef: KvDef = { collection: AsunaCollections.APP_SETTINGS, key: 'constants' };

  private static constantMapsPair: KeyValuePair;
  private static enumValueConstantMapsPair: KeyValuePair;

  /**
   * call syncMergedConstants to sync constants
   * @param key
   * @param constantMap
   */
  static async mergeConstantMaps(
    key: ConstantsKeys | string,
    constantMap: { [name: string]: string },
  ): Promise<KeyValuePair> {
    const value = { [key]: constantMap };
    if (!this.constantMapsPair) {
      this.constantMapsPair = await this.get(this.constantKvDef, {
        name: '关键词中文映射表',
        value,
        type: KeyValueType.json,
      });
    }
    // const pair = await this.get(this.constantKvDef, { name: '关键词中文映射表', value, type: 'json' });
    this.constantMapsPair.value = { ...this.constantMapsPair.value, ...value };
    // return this.set(pair);
    return this.constantMapsPair;
  }

  /**
   * call syncMergedConstants to sync constants
   * @param enumValue
   */
  static async mergeConstantMapsForEnumValue(enumValue: EnumValueStatic): Promise<KeyValuePair> {
    const value = { [enumValue.key]: enumValue.data };
    if (!this.enumValueConstantMapsPair) {
      this.enumValueConstantMapsPair = await this.get(this.constantKvDef, {
        name: '关键词中文映射表',
        value,
        type: KeyValueType.json,
      });
    }
    // const pair = await this.get(this.constantKvDef, { name: '关键词中文映射表', value, type: 'json' });
    this.enumValueConstantMapsPair.value = { ...this.enumValueConstantMapsPair.value, ...value };
    // return this.set(pair);
    return this.enumValueConstantMapsPair;
  }

  static async syncMergedConstants(): Promise<void> {
    logger.log(`merge constants ${r(this.constantMapsPair)}`);
    if (this.constantMapsPair) {
      await this.set(this.constantMapsPair);
    }
    logger.log(`merge enum constants ${r(this.enumValueConstantMapsPair)}`);
    if (this.enumValueConstantMapsPair) {
      await this.set(this.enumValueConstantMapsPair);
    }
  }

  static regInitializer<V = KVGroupFieldsValue>(
    kvDef: KvDef,
    opts: { name?: string; type?: KeyValueType; value?: V; extra?: any },
    config: { formatType?: KVModelFormatType; noUpdate?: boolean; merge?: boolean },
  ): void {
    const identifier = KvDefIdentifierHelper.stringify(kvDef);
    KvHelper.initializers[identifier] = (): Promise<KeyValuePair> => KvHelper.set<V>({ ...kvDef, ...opts }, config);
    KvHelper.initializers[identifier]();
  }

  static async set<V = any>(
    opts: { collection?: string; key: string; name?: string; type?: KeyValueType; value?: V; extra?: any },
    {
      formatType,
      merge,
      noUpdate,
    }: {
      // 用于 admin 中识别类型
      formatType?: KVModelFormatType;
      noUpdate?: boolean;
      // 用于合并 KVGroupFieldsValue 中的表单
      merge?: boolean;
    } = {},
  ): Promise<KeyValuePair> {
    const collection = opts.collection ? opts.collection.replace('/\b+/', '') : null;
    const key = opts.key ? opts.key.replace('/\b+/', '') : null;

    if (!key) {
      throw new ValidationException('kv', 'key is required');
    }

    const { name, type, value } = opts;
    const stringifyValue = _.isString(value) ? value : JSON.stringify(value);
    const [newType] = recognizeTypeValue(type, stringifyValue);
    logger.debug(`recognize ${r({ type, newType, value, stringifyValue })}`);

    const entity = {
      key,
      name,
      type: newType,
      value: stringifyValue as any,
      extra: opts.extra,
      collection: collection && collection.includes('.') ? collection : `user.${collection || 'default'}`,
    };
    const exists = await this.get(entity);
    if (exists && opts.name) {
      const model = await KeyValueModel.findOne({ name: opts.name });
      logger.verbose(`found kv model ${r(model)}`);
      if (!model) KeyValueModel.create({ name: opts.name, pair: exists, formatType }).save();
      else {
        model.formatType = formatType;
        model.save();
      }
    }
    // noUpdate 打开时如果已经存在值不进行更新
    if (exists && noUpdate && exists.value) return exists;
    if (exists && merge) {
      exists.value = JSON.stringify({
        ...exists.value,
        ..._.omit(value as any, 'values'),
      });
      logger.verbose(`inspect ${r(exists)}`);
      return exists.save();
    }

    logger.verbose(`set ${r(entity)}`);
    return KeyValuePair.save({ ...(exists ? { id: exists.id } : null), ...entity } as any).finally(() =>
      CacheUtils.clear({ prefix: 'kv', key: { collection, key } }),
    );
  }

  static async update(id: number, name: any, type: any, value: any): Promise<KeyValuePair> {
    const stringifyValue = _.isString(value) ? value : JSON.stringify(value);

    const entity = await KeyValuePair.findOne(id);
    const entityTo = KeyValuePair.merge(entity, {
      name,
      type,
      value: stringifyValue as any,
    });
    return KeyValuePair.save(entityTo);
  }

  static async delete(kvDef: KvDef): Promise<void> {
    const exists = await this.get(kvDef);
    if (exists) {
      await KeyValuePair.delete(kvDef);
    }
  }

  static async get(
    kvDef: KvDef,
    defaultPair?: { name: string; type: KeyValueType; value: any },
  ): Promise<KeyValuePair> {
    const keyValuePair = (await this.find(kvDef.collection, kvDef.key))[0];
    if (!keyValuePair && defaultPair) {
      await this.set({ ...kvDef, ...defaultPair });
      return (await this.find(kvDef.collection, kvDef.key))[0];
    }

    return keyValuePair;
  }

  static async find(collection?: string, key?: string): Promise<KeyValuePair[]> {
    return KeyValuePair.find({
      collection: collection && collection.includes('.') ? collection : `user.${collection || 'default'}`,
      ...(key ? { key } : null),
    }).then(
      fp.map((item) => {
        // eslint-disable-next-line no-param-reassign
        [, item.value] = recognizeTypeValue(item.type, item.value);
        return item;
      }),
    );
  }

  static async getConfigsByEnumKeys<KeyValues extends { [key: string]: string }>(
    kvDef: KvDef,
    keyValues: KeyValues,
  ): Promise<{ [key in keyof KeyValues]: any }> {
    return Promise.props(_.mapValues(keyValues, (key) => KvHelper.getValueByGroupFieldKV(kvDef, key)));
  }

  static async getValueByGroupFieldKV(kvDef: KvDef, fieldKey: string): Promise<any> {
    const field = await this.getGroupFieldsValueByFieldKV(kvDef, fieldKey);
    return field?.value || _.get(field, 'field.defaultValue');
  }

  /**
   * @deprecated
   * @param kvDef
   * @param identifier
   */
  static async checkPermission(kvDef: Partial<KvDef>, identifier: string): Promise<void> {
    if (kvDef.collection.startsWith('system.')) {
      if (AdminUserIdentifierHelper.identify(identifier)) {
        const resolved = AdminUserIdentifierHelper.resolve(identifier);
        const admin = await AdminUser.findOne(resolved.id);
        if (!admin?.isActive) {
          throw new AsunaException(AsunaErrorCode.InsufficientPermissions, 'admin is not active.');
        }
      }
      throw new AsunaException(AsunaErrorCode.InsufficientPermissions, 'unresolved identifier.');
    }
    // todo 非系统配置暂时直接略过权限，之后可通过 kv 本身提供更多待认证信息
  }

  static async auth({ req, res }, { collection }: { collection: string }): Promise<void> {
    if (collection.toUpperCase().startsWith(AsunaColletionPrefix.SYSTEM)) {
      await auth(req, res, 'admin');
    }
  }

  static async preload(kvDef: KvDef): Promise<KVGroupFieldsValue> {
    const value = (await KvHelper.get(kvDef))?.value;
    return CacheWrapper.do({ prefix: 'kv', key: kvDef, resolver: async () => value });
  }

  private static async getGroupFieldsValueByFieldKV(
    kvDef: KvDef,
    fieldKey: string,
  ): Promise<{ field: KVField; value: any }> {
    const fields: KVGroupFieldsValue = await CacheWrapper.do({
      prefix: 'kv',
      key: kvDef,
      resolver: async () => (await KvHelper.get(kvDef))?.value,
      strategy: 'cache-only',
    });
    if (!fields) return null;

    const result = {
      value: _.get(fields.values, fieldKey),
      field: _.get(
        _.chain(fields.form)
          .flatMap((fieldGroup) => fieldGroup.fields)
          .find((fieldDef) => fieldDef.field.name === fieldKey)
          .value(),
        'field',
      ),
    };
    logger.debug(`fields is ${r({ kvDef, fieldKey, fields, result })}`);
    return result;
  }
}
