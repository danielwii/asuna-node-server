import { Injectable } from '@nestjs/common';
import * as _ from 'lodash';
import * as fp from 'lodash/fp';
import { r, ValidationException } from '../../common';
import { LoggerFactory } from '../../common/logger';
import { KeyValuePair, ValueType } from './kv.entities';

const logger = LoggerFactory.getLogger('KvHelper');

const castToBoolean = value => value === 'true';
const isJson = value => {
  try {
    JSON.parse(value);
    return true;
  } catch (error) {
    return false;
  }
};
const toJson = value => {
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

function recognizeTypeValue(type: string, value: any) {
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

@Injectable()
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
    logger.log(`inspect ${r({ pair, collection, key, type, name, value, stringifyValue })}`);
    const exists = await this.get(entity.collection, entity.key);
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
        // logger.log(`transform ${r(item)}`);
        [, item.value] = recognizeTypeValue(item.type, item.value);
        return item;
      }),
    );
  }
}
