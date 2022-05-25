import { LoggerFactory } from '@danielwii/asuna-helper/dist/logger/factory';
import { r } from '@danielwii/asuna-helper/dist/serializer';

import _ from 'lodash';
import { DateTime, Duration } from 'luxon';
import { BaseEntity } from 'typeorm';

import { AppConfigObject } from '../../config/app.config';
import { ColumnTypeHelper } from './column.helper';

const logger = LoggerFactory.getLogger('EntityHelper');

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
          logger.error(error);
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
          logger.error(error);
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
        logger.error(`safeReloadJSON '${String(column)}' error: ${error}, ${r(entity[column])}`);
        entity[column] = defaultValue;
      }
    } else {
      entity[column] = defaultValue;
    }
  }
}

export function fixTZ<T extends BaseEntity & { createdAt?: Date; updatedAt?: Date }>(entity: T): void {
  const hours = AppConfigObject.instance.fixTz;
  if (hours) {
    if (entity.createdAt) {
      entity.createdAt = DateTime.fromJSDate(entity.createdAt).plus(Duration.fromObject({ hours })).toJSDate();
    }
    if (entity.updatedAt) {
      entity.updatedAt = DateTime.fromJSDate(entity.updatedAt).plus(Duration.fromObject({ hours })).toJSDate();
    }
  }
}
