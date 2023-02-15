import { Logger } from '@nestjs/common';

import { AsunaErrorCode, AsunaException, ValidationException } from '@danielwii/asuna-helper/dist/exceptions';
import { r } from '@danielwii/asuna-helper/dist/serializer';

import bluebird from 'bluebird';
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
import { AsunaCollectionPrefix, KVField, KVGroupFieldsValue, KvDef, recognizeTypeValue } from './kv.service';

const { Promise } = bluebird;

/**
 * @deprecated use {@link KvService}
 */
export class KvHelper {
  // private static initializers: { [key: string]: () => Promise<KeyValuePair> } = {};
  // static registerForms: { [identifier: string]: any } = {};
  // static constantMaps: { [key: string]: { [name: string]: string } } = {};
  // public static constantKvDef: KvDef = { collection: AsunaCollections.APP_SETTINGS, key: 'constants' };
  // private static constantMapsPair: KeyValuePair;
  // private static enumValueConstantMapsPair: KeyValuePair;

  /*
  /!**
   * call syncMergedConstants to sync constants
   * @param key
   * @param constantMap
   *!/
  public static async mergeConstantMaps(
    key: ConstantsKeys | string,
    constantMap: { [name: string]: string },
  ): Promise<KeyValuePair> {
    const value = { [key]: constantMap };
    if (!KvHelper.constantMapsPair) {
      KvHelper.constantMapsPair = await KvHelper.get(KvHelper.constantKvDef, {
        name: '关键词中文映射表',
        value,
        type: KeyValueType.json,
      });
    }
    // const pair = await KvHelper.get(KvHelper.constantKvDef, { name: '关键词中文映射表', value, type: 'json' });
    KvHelper.constantMapsPair.value = { ...KvHelper.constantMapsPair.value, ...value };
    // return KvHelper.set(pair);
    return KvHelper.constantMapsPair;
  }
*/

  /*
  /!**
   * call syncMergedConstants to sync constants
   * @param enumValue
   *!/
  public static async mergeConstantMapsForEnumValue(enumValue: EnumValueStatic): Promise<KeyValuePair> {
    const value = { [enumValue.key]: enumValue.data };
    if (!KvHelper.enumValueConstantMapsPair) {
      KvHelper.enumValueConstantMapsPair = await KvHelper.get(KvHelper.constantKvDef, {
        name: '关键词中文映射表',
        value,
        type: KeyValueType.json,
      });
    }
    // const pair = await KvHelper.get(KvHelper.constantKvDef, { name: '关键词中文映射表', value, type: 'json' });
    KvHelper.enumValueConstantMapsPair.value = { ...KvHelper.enumValueConstantMapsPair.value, ...value };
    // return KvHelper.set(pair);
    return KvHelper.enumValueConstantMapsPair;
  }
*/

  /*
  public static async syncMergedConstants(): Promise<void> {
    Logger.log(`merge constants ${r(KvHelper.constantMapsPair)}`);
    if (KvHelper.constantMapsPair) {
      await KvHelper.set(KvHelper.constantMapsPair);
    }
    Logger.log(`merge enum constants ${r(KvHelper.enumValueConstantMapsPair)}`);
    if (KvHelper.enumValueConstantMapsPair) {
      await KvHelper.set(KvHelper.enumValueConstantMapsPair);
    }
  }
*/

  /*
  public static async reInitInitializer(kvDef: KvDef) {
    const initializer = KvHelper.initializers[KvDefIdentifierHelper.stringify(kvDef)];
    if (initializer) await initializer();
  }
*/

  /*
  public static regInitializer<V = KVGroupFieldsValue>(
    kvDef: KvDef,
    opts: { name?: string; type?: KeyValueType; value?: V; extra?: any },
    config: { formatType?: KVModelFormatType; noUpdate?: boolean; merge?: boolean },
  ): void {
    const identifier = KvDefIdentifierHelper.stringify(kvDef);
    KvHelper.initializers[identifier] = (): Promise<KeyValuePair> => KvHelper.set<V>({ ...kvDef, ...opts }, config);
    KvHelper.initializers[identifier]();
  }
*/

  public static async set<V = any>(
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
    Logger.verbose(`recognize ${r({ type, newType, value, stringifyValue })}`);

    const entity = {
      key,
      name,
      type: newType,
      value: stringifyValue as any,
      extra: opts.extra,
      collection: collection?.includes('.') ? collection : `user.${collection || 'default'}`,
    };
    const exists = await KvHelper.get(entity);
    if (exists && opts.name) {
      const model = await KeyValueModel.findOneBy({ name: opts.name });
      Logger.verbose(`found kv model ${r({ model, name: opts.name })}`);
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
      Logger.debug(`inspect ${r(exists)}`);
      return exists.save();
    }

    Logger.debug(`set ${r(entity)}`);
    return KeyValuePair.create({
      // ...R.ifElse(R.identity, R.always({ id: exists?.id }), R.always({}))(!!exists),
      ...(exists ? { id: exists.id } : {}),
      ...entity,
    })
      .save()
      .finally(() => CacheUtils.clear({ prefix: 'kv', key: { collection, key } }));
  }

  public static async update(id: number, name: any, type: any, value: any): Promise<KeyValuePair> {
    const stringifyValue = _.isString(value) ? value : JSON.stringify(value);

    const entity = await KeyValuePair.findOneBy({ id });
    const entityTo = KeyValuePair.merge(entity, { name, type, value: stringifyValue as any });
    return KeyValuePair.save(entityTo);
  }

  public static async delete(kvDef: KvDef): Promise<void> {
    const exists = await KvHelper.get(kvDef);
    if (exists) {
      await KeyValuePair.delete({ ...kvDef });
    }
  }

  public static async get(
    kvDef: KvDef,
    defaultPair?: { name: string; type: KeyValueType; value: any },
  ): Promise<KeyValuePair> {
    const keyValuePair = (await KvHelper.find(kvDef.collection, kvDef.key))[0];
    if (!keyValuePair && defaultPair) {
      await KvHelper.set({ ...kvDef, ...defaultPair });
      return (await KvHelper.find(kvDef.collection, kvDef.key))[0];
    }

    return keyValuePair;
  }

  public static async find(collection?: string, key?: string): Promise<KeyValuePair[]> {
    return CacheWrapper.do({
      prefix: 'kv:cache',
      key: { prefix: collection, key },
      resolver: async () =>
        KeyValuePair.findBy({
          collection: collection?.includes('.') ? collection : `user.${collection || 'default'}`,
          ...(key ? { key } : {}),
        }).then(
          fp.map((item) => {
            // eslint-disable-next-line no-param-reassign
            [, item.value] = recognizeTypeValue(item.type, item.value);
            return item;
          }),
        ),
      expiresInSeconds: 60,
    });
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
  public static async getConfigsByEnumKeys<KeyValues extends { [key: string]: string }>(
    kvDef: KvDef,
    keyValues: KeyValues,
    funcName?: string,
  ): Promise<{ [key in keyof KeyValues]: any }> {
    Logger.log(`#${funcName} ${r({ kvDef, keyValues })}`);
    return Promise.props(_.mapValues(keyValues, (key) => KvHelper.getValueByGroupFieldKV(kvDef, key)));
  }

  public static async getValueByGroupFieldKV(kvDef: KvDef, fieldKey: string): Promise<any> {
    const field = await KvHelper.getGroupFieldsValueByFieldKV(kvDef, fieldKey);
    if (field) return field.value ?? _.get(field, 'field.defaultValue');
  }

  /**
   * @deprecated
   * @param kvDef
   * @param identifier
   */
  public static async checkPermission(kvDef: Partial<KvDef>, identifier: string): Promise<void> {
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

  public static async auth({ req, res }, { collection }: { collection: string }): Promise<void> {
    if (collection.toUpperCase().startsWith(AsunaCollectionPrefix.SYSTEM)) {
      await auth(req, res, AuthType.admin);
    }
  }

  /*
  public static async preload(kvDef: KvDef): Promise<KVGroupFieldsValue> {
    const value = (await KvHelper.get(kvDef))?.value;
    return CacheWrapper.do({ prefix: 'kv', key: kvDef, resolver: async () => value, strategy: 'cache-first' });
  }
*/

  private static async getGroupFieldsValueByFieldKV(
    kvDef: KvDef,
    fieldKey: string,
  ): Promise<{ field: KVField; value: any } | void> {
    const fields: KVGroupFieldsValue = await CacheWrapper.do({
      prefix: 'kv',
      key: kvDef,
      resolver: async () => (await KvHelper.get(kvDef))?.value,
      strategy: 'cache-first',
      expiresInSeconds: 60,
    });
    if (!fields) return;

    // Logger.verbose(`fields is ${r({ kvDef, fieldKey, fields, result })}`);
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
