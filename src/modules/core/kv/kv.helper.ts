import * as _ from 'lodash';
import * as fp from 'lodash/fp';
import { r, ValidationException } from '../../common';
import { LoggerFactory } from '../../common/logger';
import { KeyValuePair, ValueType } from './kv.entities';

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
  type: 'number' | 'string';
  help?: string;
  required?: boolean;
  defaultValue?: boolean | number | string;
};

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

function recognizeTypeValue(type: keyof typeof ValueType, value: any): [keyof typeof ValueType, string] {
  let newType = type;
  let newValue = value;
  if (type) {
    if (Object.values(ValueType).includes(type)) {
      if (type.toLowerCase() === ValueType.boolean) {
        newValue = castToBoolean(value);
      } else if (type.toLowerCase() === ValueType.number) {
        newValue = +value;
      } else if (['json', 'images', 'videos'].includes(type.toLowerCase())) {
        newValue = toJson(value);
      }
    }
  } else if (value === 'true' || value === 'false') {
    newType = 'boolean';
    newValue = castToBoolean(value);
  } else if (!_.isNaN(+value)) {
    newType = 'number';
    newValue = +value;
  } else if (isJson(value)) {
    newType = 'json';
    newValue = toJson(value);
  }
  // logger.log(`recognizeTypeValue ${r({ type, value, newType, newValue })}`);
  return [newType || 'string', newValue];
}

export const AsunaCollections = {
  SYSTEM_SERVER: 'system.server',
};

export class KvHelper {
  /**
   * @param pair noValueOnly 仅在值为空时或不存在时设置
   */
  static async set(pair: {
    collection?: string;
    key: string;
    name?: string;
    type: keyof typeof ValueType;
    value: any;
    extra?: any;
    noUpdate?: boolean;
  }): Promise<KeyValuePair> {
    const collection = pair.collection ? pair.collection.replace('/\b+/', '') : null;
    const key = pair.key ? pair.key.replace('/\b+/', '') : null;

    if (!key) {
      throw new ValidationException('kv', 'key is required');
    }

    const { name, type, value } = pair;
    const stringifyValue = _.isString(value) ? value : JSON.stringify(value);
    const [newType] = recognizeTypeValue(type, stringifyValue);

    const entity = {
      key,
      name,
      type: newType,
      value: stringifyValue as any,
      extra: pair.extra,
      collection: collection && collection.includes('.') ? collection : `user.${collection || 'default'}`,
    };
    const exists = await this.get(entity.collection, entity.key);
    logger.log(`inspect ${r({ pair, collection, key, type, name, value, exists })}`);
    // noUpdate 打开时如果已经存在值不进行更新
    if (exists && pair.noUpdate && exists.value) return exists;

    logger.log(`set ${r({ entity, exists })}`);
    return KeyValuePair.save({ ...(exists ? { id: exists.id } : null), ...entity } as any);
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

  static async get(
    collection: string,
    key: string,
    defaultPair?: {
      collection?: string;
      key: string;
      name: string;
      type: keyof typeof ValueType;
      value: any;
    },
  ): Promise<KeyValuePair> {
    const keyValuePair = (await this.find(collection, key))[0];
    if (!keyValuePair && defaultPair) {
      return this.set(defaultPair);
    }
    return keyValuePair;
  }

  static async find(collection?: string, key?: string): Promise<KeyValuePair[]> {
    return KeyValuePair.find({
      collection: collection && collection.includes('.') ? collection : `user.${collection || 'default'}`,
      ...(key ? { key } : null),
    }).then(
      fp.map(item => {
        // eslint-disable-next-line no-param-reassign
        [, item.value] = recognizeTypeValue(item.type, item.value);
        return item;
      }),
    );
  }

  static async getValueByGroupFieldKV(kvDef: { collection: string; key: string }, fieldKey: string): Promise<any> {
    const field = await this.getGroupFieldsValueByFieldKV(kvDef, fieldKey);
    return field ? field.value || _.get(field, 'field.defaultValue') : null;
  }

  private static async getGroupFieldsValueByFieldKV(
    kvDef: { collection: string; key: string },
    fieldKey: string,
  ): Promise<{ field: KVField; value: any }> {
    const fields: KVGroupFieldsValue = (await KvHelper.get(kvDef.collection, kvDef.key)).value;
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
}
