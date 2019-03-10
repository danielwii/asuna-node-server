import { Injectable, Logger } from '@nestjs/common';
import { InjectConnection } from '@nestjs/typeorm';
import * as _ from 'lodash';
import * as fp from 'lodash/fp';
import { Connection, Repository } from 'typeorm';
import * as util from 'util';
import { ValidationException } from '../base/base.exceptions';
import { KeyValuePair, ValueType } from './kv.entities';

const logger = new Logger('KvService');

const castToBoolean = value => value === 'true';
const isJson = value => {
  try {
    JSON.parse(value);
    return true;
  } catch (e) {
    return false;
  }
};
const toJson = value => {
  try {
    return JSON.parse(value);
  } catch (e) {
    logger.error(e);
    return value;
  }
};

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
  } else {
    if (value === 'true' || value === 'false') {
      newType = 'boolean';
      newValue = castToBoolean(value);
    } else if (!_.isNaN(+value)) {
      newType = 'number';
      newValue = +value;
    } else if (isJson(value)) {
      newType = 'json';
      newValue = toJson(value);
    }
  }
  // logger.log(
  //   `recognizeTypeValue ${util.inspect({ type, value, newType, newValue }, { colors: true })}`,
  // );
  return [newType || 'string', newValue];
}

@Injectable()
export class KvService {
  private readonly kvPairRepository: Repository<KeyValuePair>;

  constructor(@InjectConnection() private readonly connection: Connection) {
    this.kvPairRepository = connection.getRepository(KeyValuePair);
  }

  async set(
    collection: string,
    key: string,
    name: string,
    type: keyof typeof ValueType,
    value: any,
  ) {
    collection = collection ? collection.replace('/\b+/', '') : null;
    key = key ? key.replace('/\b+/', '') : null;

    if (!key) {
      throw new ValidationException('kv', 'key must not be blank');
    }

    const stringifyValue = _.isString(value) ? value : JSON.stringify(value);
    const [newType] = recognizeTypeValue(type, stringifyValue);

    const entity = {
      key,
      name,
      type: newType,
      value: stringifyValue as any,
      collection:
        collection && collection.includes('.') ? collection : `user.${collection || 'default'}`,
    };
    logger.log({ collection, key, type, value, stringifyValue });
    const exists = await this.get(entity.collection, entity.key);
    logger.log(`set ${util.inspect({ entity, exists }, { colors: true })}`);
    return this.kvPairRepository.save({ ...(exists ? { id: exists.id } : null), ...entity });

    // logger.log(`set ${util.inspect({ entity }, { colors: true })}`);
    // return this.kvPairRepository.save(entity);
  }

  async update(id: number, name: any, type: any, value: any) {
    const stringifyValue = _.isString(value) ? value : JSON.stringify(value);

    const entity = await this.kvPairRepository.findOne(id);
    const entityTo = this.kvPairRepository.merge(entity, {
      name,
      type,
      value: stringifyValue as any,
    });
    return this.kvPairRepository.save(entityTo);
  }

  async get(collection: string, key: string) {
    return (await this.find(collection, key))[0];
  }

  async find(collection?: string, key?: string) {
    return this.kvPairRepository
      .find({
        collection:
          collection && collection.includes('.') ? collection : `user.${collection || 'default'}`,
        ...(key ? { key } : null),
      })
      .then(
        fp.map(item => {
          // logger.log(`transform ${util.inspect(item, { colors: true })}`);
          [, item.value] = recognizeTypeValue(item.type, item.value);
          return item;
        }),
      );
  }
}
