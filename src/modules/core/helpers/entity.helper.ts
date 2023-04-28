import { Logger } from '@nestjs/common';

import { r } from '@danielwii/asuna-helper/dist/serializer';

import _ from 'lodash';

import { ColumnTypeHelper } from './column.helper';

/**
 * @deprecated {@see safeReloadJSON}
 */
export function safeReloadArray<Entity>(entity: Entity, ...columns: (keyof Entity)[]): void {
  columns.forEach((column) => {
    if (ColumnTypeHelper.JSON === 'simple-json') {
      if (entity[column]) {
        try {
          if (!_.isObject(entity[column])) {
            entity[column] = JSON.parse(entity[column] as any);
          }
        } catch (error) {
          Logger.error(error);
          entity[column] = [] as any;
        }
      } else {
        entity[column] = [] as any;
      }
    }
  });
}

/**
 * @deprecated {@see safeReloadJSON}
 */
export function safeReloadObject<Entity>(entity: Entity, ...columns: (keyof Entity)[]): void {
  columns.forEach((column) => {
    if (ColumnTypeHelper.JSON === 'simple-json') {
      if (entity[column]) {
        try {
          if (!_.isObject(entity[column])) {
            entity[column] = JSON.parse(entity[column] as any);
          }
        } catch (error) {
          Logger.error(error);
          entity[column] = {} as any;
        }
      } else {
        entity[column] = {} as any;
      }
    }
  });
}

export function safeReloadJSON<Entity>(entity: Entity, column: keyof Entity, defaultValue?): void {
  // logger.debug(`safeReloadJSON ${r({ entity: typeof entity, column, value: entity[column], defaultValue })}`);
  if (_.has(entity, column)) {
    if (entity[column]) {
      try {
        if (!_.isObject(entity[column])) {
          entity[column] = JSON.parse(entity[column] as any);
        }
      } catch (error) {
        Logger.error(`safeReloadJSON '${String(column)}' error: ${error}, ${r(entity[column])}`);
        entity[column] = defaultValue;
      }
    } else {
      entity[column] = defaultValue;
    }
  }
}
