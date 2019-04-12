import * as _ from 'lodash';

import { jsonType } from './column.helper';

export function safeReloadArray<Entity>(entity: Entity, column: keyof Entity) {
  if (jsonType() === 'simple-json') {
    if (entity[column]) {
      try {
        if (!_.isObject(entity[column])) {
          JSON.parse(entity[column] as any);
        }
      } catch (e) {
        console.error(e);
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
        console.error(e);
        entity[column] = {} as any;
      }
    } else {
      entity[column] = {} as any;
    }
  }
}

export function safeReloadJSON<Entity>(entity: Entity, column: keyof Entity) {
  if (jsonType() === 'simple-json') {
    if (entity[column]) {
      try {
        if (!_.isObject(entity[column])) {
          JSON.parse(entity[column] as any);
        }
      } catch (e) {
        console.error(e);
        entity[column] = null;
      }
    } else {
      entity[column] = null;
    }
  }
}
