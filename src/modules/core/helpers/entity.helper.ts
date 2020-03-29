// eslint-disable-next-line eslint-comments/disable-enable-pair
/* eslint-disable no-param-reassign */
import * as _ from 'lodash';
import { DateTime, Duration } from 'luxon';
import { BaseEntity } from 'typeorm';
import { LoggerFactory } from '../../common/logger/factory';
import { ConfigKeys, configLoader } from '../../config';
import { ColumnType } from './column.helper';

const logger = LoggerFactory.getLogger('EntityHelper');

export function safeReloadArray<Entity>(entity: Entity, ...columns: (keyof Entity)[]): void {
  columns.forEach(column => {
    if (ColumnType.JSON === 'simple-json') {
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

export function safeReloadObject<Entity>(entity: Entity, ...columns: (keyof Entity)[]): void {
  columns.forEach(column => {
    if (ColumnType.JSON === 'simple-json') {
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

export function safeReloadJSON<Entity>(entity: Entity, ...columns: (keyof Entity)[]): void {
  columns.forEach(column => {
    if (entity && column /* && ColumnType.JSON === 'simple-json' */) {
      if (entity[column]) {
        try {
          if (!_.isObject(entity[column])) {
            entity[column] = JSON.parse(entity[column] as any);
          }
        } catch (error) {
          logger.error(`safeReloadJSON ${column} error: ${error}`);
          // entity[column] = null;
        }
      } else {
        // entity[column] = null;
      }
    }
  });
}

export function fixTZ<T extends BaseEntity & { createdAt?: Date; updatedAt?: Date }>(entity: T): void {
  const hours = configLoader.loadNumericConfig(ConfigKeys.FIX_TZ);
  if (hours) {
    if (entity.createdAt) {
      entity.createdAt = DateTime.fromJSDate(entity.createdAt)
        .plus(Duration.fromObject({ hours }))
        .toJSDate();
    }
    if (entity.updatedAt) {
      entity.updatedAt = DateTime.fromJSDate(entity.updatedAt)
        .plus(Duration.fromObject({ hours }))
        .toJSDate();
    }
  }
}
