import { Injectable, Logger } from '@nestjs/common';

import { AsunaErrorCode, AsunaException, ValidationException } from '@danielwii/asuna-helper/dist/exceptions';
import { resolveModule } from '@danielwii/asuna-helper/dist/logger/factory';
import { r } from '@danielwii/asuna-helper/dist/serializer';
import { StaticImplements } from '@danielwii/asuna-helper/dist/types';
import { deserializeSafely } from '@danielwii/asuna-helper/dist/validate';

import { fileURLToPath } from 'node:url';

import bluebird from 'bluebird';
import { IsString } from 'class-validator';
import _ from 'lodash';
import fp from 'lodash/fp';

import { CacheUtils } from '../../cache/utils';
import { CacheWrapper } from '../../cache/wrapper';
import { named } from '../../helper/annotations';
import { AuthType, auth } from '../../helper/auth';
import { AdminUser } from '../auth/auth.entities';
import { AdminUserIdentifierHelper } from '../auth/identifier';
import { KeyValuePair, KeyValueType } from './kv.entities';
import { KVModelFormatType, KeyValueModel } from './kv.isolated.entities';

import type { IdentifierHelper } from '../../common/identifier';
import type { EnumValueStatic } from '../../enum-values';

const { Promise } = bluebird;

const castToBoolean = (value): boolean => value === 'true';
const isJson = (value): boolean => {
  try {
    JSON.parse(value);
    return true;
  } catch {
    return false;
  }
};
const toJson = (value): JSON => {
  try {
    return JSON.parse(value);
  } catch (error) {
    Logger.error(`${r({ value })} toJson error: ${r(error)}`);
    return value;
  }
};

export interface KVField {
  name: string;
  type:
    | 'number'
    | 'string'
    | 'stringArray'
    | 'text'
    | 'json'
    | 'image'
    | 'color'
    | 'wxSubscribeData'
    | 'wxTmplData'
    | 'emailTmplData'
    | 'boolean';
  help?: string;
  required?: boolean;
  defaultValue?: boolean | number | string;
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

export interface KVListFieldsValue<V> {
  type: string;
  fields: { name?: string; field: KVField }[];
  values: V[];
}

export interface KVFieldsValue {
  fields: Record<string, KVField>;
  values: any;
}

export interface KVGroupFieldsValue {
  form?: KVGroupFields;
  values: any;
}

export function recognizeTypeValue(type: KeyValueType, value: any): [KeyValueType, string] {
  let newType = type;
  let newValue = value;
  if (type) {
    if (Object.values(KeyValueType).includes(type)) {
      if (type === KeyValueType.boolean) {
        newValue = castToBoolean(value);
      } else if (type === KeyValueType.number) {
        newValue = Number(value);
      } else if (['json', 'images', 'videos'].includes(type)) {
        newValue = _.isString(value) ? toJson(value) : value;
      }
    }
  } else if (value === 'true' || value === 'false') {
    newType = KeyValueType.boolean;
    newValue = castToBoolean(value);
  } else if (!_.isNaN(Number(value))) {
    newType = KeyValueType.number;
    newValue = Number(value);
  } else if (isJson(value)) {
    newType = KeyValueType.json;
    newValue = toJson(value);
  }
  // this.logger.log(`recognizeTypeValue ${r({ type, value, newType, newValue })}`);
  return [newType || KeyValueType.string, newValue];
}

export enum AsunaCollectionPrefix {
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
  THIRD_SETTINGS: '3rd.settings',
};

export class KvDef {
  @IsString() public collection: string;
  @IsString() public key: string;

  public constructor(o: KvDef) {
    Object.assign(this, deserializeSafely(KvDef, o));
  }
}

@StaticImplements<IdentifierHelper<KvDef>>()
export class KvDefIdentifierHelper {
  public static parse = (identifier: string): KvDef => ({
    collection: identifier.split('#')[0],
    key: identifier.split('#')[1],
  });

  public static stringify = (payload: KvDef): string => `${payload.collection}#${payload.key}`;
}

export type ConstantsKeys = 'WXMessageIds';

@Injectable()
export class KvService {
  private readonly logger = new Logger(resolveModule(fileURLToPath(import.meta.url), this.constructor.name));

  private static initializers: { [key: string]: () => Promise<KeyValuePair> } = {};
  // static registerForms: { [identifier: string]: any } = {};
  // static constantMaps: { [key: string]: { [name: string]: string } } = {};
  public static constantKvDef: KvDef = { collection: AsunaCollections.APP_SETTINGS, key: 'constants' };

  private static constantMapsPair: KeyValuePair;
  private static enumValueConstantMapsPair: KeyValuePair;

  /**
   * call syncMergedConstants to sync constants
   * @param key
   * @param constantMap
   */
  public async mergeConstantMaps(
    key: ConstantsKeys | string,
    constantMap: { [name: string]: string },
  ): Promise<KeyValuePair> {
    const value = { [key]: constantMap };
    if (!KvService.constantMapsPair) {
      KvService.constantMapsPair = await this.get(KvService.constantKvDef, {
        name: '关键词中文映射表',
        value,
        type: KeyValueType.json,
      });
    }
    // const pair = await this.get(this.constantKvDef, { name: '关键词中文映射表', value, type: 'json' });
    KvService.constantMapsPair.value = { ...KvService.constantMapsPair.value, ...value };
    // return this.set(pair);
    return KvService.constantMapsPair;
  }

  /**
   * call syncMergedConstants to sync constants
   * @param enumValue
   */
  public async mergeConstantMapsForEnumValue(enumValue: EnumValueStatic): Promise<KeyValuePair> {
    const value = { [enumValue.key]: enumValue.data };
    if (!KvService.enumValueConstantMapsPair) {
      KvService.enumValueConstantMapsPair = await this.get(KvService.constantKvDef, {
        name: '关键词中文映射表',
        value,
        type: KeyValueType.json,
      });
    }
    if (!KvService.enumValueConstantMapsPair) throw new Error(`enumValueConstantMapsPair not found`);
    // const pair = await this.get(this.constantKvDef, { name: '关键词中文映射表', value, type: 'json' });
    KvService.enumValueConstantMapsPair.value = { ...KvService.enumValueConstantMapsPair.value, ...value };
    // return this.set(pair);
    return KvService.enumValueConstantMapsPair;
  }

  public async syncMergedConstants(): Promise<void> {
    this.logger.log(`merge constants ${r(KvService.constantMapsPair)}`);
    if (KvService.constantMapsPair) {
      await this.set(KvService.constantMapsPair);
    }
    this.logger.log(`merge enum constants ${r(KvService.enumValueConstantMapsPair)}`);
    if (KvService.enumValueConstantMapsPair) {
      await this.set(KvService.enumValueConstantMapsPair);
    }
  }

  public async reInitInitializer(kvDef: KvDef) {
    const initializer = KvService.initializers[KvDefIdentifierHelper.stringify(kvDef)];
    if (initializer) await initializer();
  }

  public regInitializer<V = KVGroupFieldsValue>(
    kvDef: KvDef,
    opts: { name?: string; type?: KeyValueType; value?: V; extra?: any },
    config: { formatType?: KVModelFormatType; noUpdate?: boolean; merge?: boolean },
  ): Promise<KeyValuePair> {
    const identifier = KvDefIdentifierHelper.stringify(kvDef);
    KvService.initializers[identifier] = (): Promise<KeyValuePair> => this.set<V>({ ...kvDef, ...opts }, config);
    return KvService.initializers[identifier]();
  }

  public async set<V = any>(
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
    const collection = opts.collection ? opts.collection.replace('/\b+/', '') : undefined;
    const key = opts.key ? opts.key.replace('/\b+/', '') : undefined;

    if (!key) {
      throw new ValidationException('kv', 'key is required');
    }

    const { name, type, value } = opts;
    const stringifyValue = _.isString(value) ? value : JSON.stringify(value);
    const [newType] = recognizeTypeValue(type, stringifyValue);
    this.logger.verbose(`recognize ${r({ type, newType, value, stringifyValue })}`);

    const entity = {
      key,
      name,
      type: newType,
      value: stringifyValue as any,
      extra: opts.extra,
      collection: collection?.includes('.') ? collection : `user.${collection || 'default'}`,
    };
    const exists = await this.get(entity);
    if (exists && opts.name) {
      const model = await KeyValueModel.findOneBy({ name: opts.name });
      this.logger.verbose(`found kv model ${r({ model, name: opts.name })}`);
      if (!model) KeyValueModel.create({ name: opts.name, pair: exists, formatType }).save();
      else {
        model.formatType = formatType;
        model.save();
      }
    }
    // noUpdate 打开时如果已经存在值不进行更新
    if (exists && noUpdate && exists.value) return exists;
    if (exists && merge) {
      exists.value = JSON.stringify({ ...exists.value, ..._.omit(value as any, 'values') });
      this.logger.debug(`inspect ${r(exists)}`);
      return exists.save();
    }

    this.logger.debug(`set ${r(entity)}`);
    return KeyValuePair.create({
      // ...R.ifElse(R.identity, R.always({ id: exists?.id }), R.always({}))(!!exists),
      ...(exists ? { id: exists.id } : {}),
      ...entity,
    })
      .save()
      .finally(() => CacheUtils.clear({ prefix: 'kv', key: { collection, key } }));
  }

  public async update(id: number, name: any, type: any, value: any): Promise<KeyValuePair> {
    const stringifyValue = _.isString(value) ? value : JSON.stringify(value);

    const entity = await KeyValuePair.findOneBy({ id });
    const entityTo = KeyValuePair.merge(entity, { name, type, value: stringifyValue as any });
    return KeyValuePair.save(entityTo);
  }

  public async delete(kvDef: KvDef): Promise<void> {
    const exists = await this.get(kvDef);
    if (exists) {
      await KeyValuePair.delete({ ...kvDef });
    }
  }

  public async get(
    kvDef: KvDef,
    defaultPair?: { name: string; type: KeyValueType; value: any },
  ): Promise<KeyValuePair> {
    const keyValuePairs = await this.find(kvDef.collection, kvDef.key);
    this.logger.log(`get ${r({ kvDef, keyValuePairs })}`);
    const keyValuePair = keyValuePairs[0];
    if (!keyValuePair && defaultPair) {
      await this.set({ ...kvDef, ...defaultPair });
      return (await this.find(kvDef.collection, kvDef.key))[0];
    }

    return keyValuePair;
  }

  public async find(collection?: string, key?: string): Promise<KeyValuePair[]> {
    return KeyValuePair.findBy({
      collection: collection?.includes('.') ? collection : `user.${collection || 'default'}`,
      ...(key ? { key } : {}),
    }).then(
      fp.map((item) => {
        // eslint-disable-next-line no-param-reassign
        [, item.value] = recognizeTypeValue(item.type, item.value);
        return item;
      }),
    );
    /*
    return KeyValuePair.findBy({
      collection: collection?.includes('.') ? collection : `user.${collection || 'default'}`,
      ...(key ? { key } : {}),
    }).then(
      fp.map((item) => {
        // eslint-disable-next-line no-param-reassign
        [, item.value] = recognizeTypeValue(item.type, item.value);
        return item;
      }),
    ); */
  }

  @named
  public async getConfigsByEnumKeys<KeyValues extends { [key: string]: string }>(
    kvDef: KvDef,
    keyValues: KeyValues,
    funcName?: string,
  ): Promise<{ [key in keyof KeyValues]: any }> {
    this.logger.log(`#${funcName}: ${r({ kvDef, keyValues })}`);
    return Promise.props(_.mapValues(keyValues, (key) => this.getValueByGroupFieldKV(kvDef, key)));
  }

  public async getValueByGroupFieldKV(kvDef: KvDef, fieldKey: string): Promise<any> {
    const field = await this.getGroupFieldsValueByFieldKV(kvDef, fieldKey);
    if (field) return field.value ?? _.get(field, 'field.defaultValue');
  }

  /**
   * @deprecated
   * @param kvDef
   * @param identifier
   */
  public async checkPermission(kvDef: Partial<KvDef>, identifier: string): Promise<void> {
    if (kvDef.collection.startsWith('system.')) {
      if (AdminUserIdentifierHelper.identify(identifier)) {
        const resolved = AdminUserIdentifierHelper.resolve(identifier);
        const admin = await AdminUser.findOneBy({ id: resolved.id as string });
        if (!admin?.isActive) {
          throw new AsunaException(AsunaErrorCode.InsufficientPermissions, 'admin is not active.');
        }
      }
      throw new AsunaException(AsunaErrorCode.InsufficientPermissions, 'unresolved identifier.');
    }
    // todo 非系统配置暂时直接略过权限，之后可通过 kv 本身提供更多待认证信息
  }

  public async auth({ req, res }, { collection }: { collection: string }): Promise<void> {
    if (collection.toUpperCase().startsWith(AsunaCollectionPrefix.SYSTEM)) {
      await auth(req, res, AuthType.admin);
    }
  }

  public async preload(kvDef: KvDef): Promise<KVGroupFieldsValue> {
    const value = (await this.get(kvDef))?.value;
    return CacheWrapper.do({ prefix: 'kv', key: kvDef, resolver: async () => value, strategy: 'cache-first' });
  }

  private async getGroupFieldsValueByFieldKV(
    kvDef: KvDef,
    fieldKey: string,
  ): Promise<{ field: KVField; value: any } | void> {
    const fields: KVGroupFieldsValue = await CacheWrapper.do({
      prefix: 'kv',
      key: kvDef,
      resolver: async () => (await this.get(kvDef))?.value,
      strategy: 'cache-first',
      expiresInSeconds: 60,
    });
    if (!fields) return;

    // this.logger.verbose(`fields is ${r({ kvDef, fieldKey, fields, result })}`);
    return {
      value: _.get(fields.values, fieldKey),
      field: _.get(
        _.chain(fields.form)
          .flatMap((fieldGroup) => fieldGroup.fields)
          .find((fieldDef) => fieldDef.field.name === fieldKey)
          .value(),
        'field',
      ),
    };
  }
}
