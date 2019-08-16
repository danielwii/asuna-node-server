import * as _ from 'lodash';
import { r } from '../../common/helpers';
import { LoggerFactory } from '../../common/logger/factory';
import { jsonType } from './column.helper';

const logger = LoggerFactory.getLogger('EntityHelper');

export function safeReloadArray<Entity>(entity: Entity, column: keyof Entity) {
  if (jsonType() === 'simple-json') {
    if (entity[column]) {
      try {
        if (!_.isObject(entity[column])) {
          JSON.parse(entity[column] as any);
        }
      } catch (e) {
        logger.error(r(e));
        entity[column] = [] as any;
      }
    } else {
      entity[column] = [] as any;
    }
  }
}

export function safeReloadObject<Entity>(entity: Entity, column: keyof Entity) {
  if (jsonType() === 'simple-json') {
    if (entity[column]) {
      try {
        if (!_.isObject(entity[column])) {
          JSON.parse(entity[column] as any);
        }
      } catch (e) {
        logger.error(r(e));
        entity[column] = {} as any;
      }
    } else {
      entity[column] = {} as any;
    }
  }
}

export function safeReloadJSON<Entity>(entity: Entity, column: keyof Entity) {
  if (entity && column && jsonType() === 'simple-json') {
    if (entity[column]) {
      try {
        if (!_.isObject(entity[column])) {
          JSON.parse(entity[column] as any);
        }
      } catch (e) {
        logger.error(r(e));
        entity[column] = null;
      }
    } else {
      entity[column] = null;
    }
  }
}
