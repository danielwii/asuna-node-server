import { Logger } from '@nestjs/common';

import { resolveModule } from '@danielwii/asuna-helper/dist/logger/factory';
import { r } from '@danielwii/asuna-helper/dist/serializer';
import { validateObjectSync } from '@danielwii/asuna-helper/dist/validate';

import _ from 'lodash';
import { BaseEntity, EntitySubscriberInterface, EventSubscriber, InsertEvent, RemoveEvent, UpdateEvent } from 'typeorm';
import { fileURLToPath } from 'node:url';

import { CacheHelper, CleanCacheType } from '../../cache';
import { PubSubChannels, PubSubHelper } from '../../pub-sub/pub-sub.helper';
import { ColumnTypeHelper, safeReloadJSON } from '../helpers';

import type { EntityMetadata } from 'typeorm/metadata/EntityMetadata';
import type { LoadEvent } from 'typeorm/subscriber/event/LoadEvent';
import type { MetaInfoOptions } from '@danielwii/asuna-shared';

const safeReload = (metadata: EntityMetadata, entity): void => {
  if (!_.isObject(entity)) return;

  const { info }: { info: { [key: string]: MetaInfoOptions } } = (metadata.target as Function).prototype;
  metadata.columns.forEach((column) => {
    if (column.type === ColumnTypeHelper.JSON) {
      // if (!info) throw new Error(`no meta info for json field ${r({ entity, field: column.propertyName })}`);
      // const entityInfo = (column.target as any).entityInfo as MetaInfoBaseOptions;
      const defaultValue = _.cond([
        [_.matches('json-array'), _.constant([])],
        [_.matches('json-map'), _.constant({})],
        [_.stubTrue, _.constant(null)],
      ])(info?.[column.propertyName]?.safeReload);
      safeReloadJSON(entity as any, column.propertyName, defaultValue);
    } else if (column.type === 'decimal') {
      entity[column.propertyName] = _.toNumber(entity[column.propertyName]);
    }
  });
};

@EventSubscriber()
export class EntitySubscriber implements EntitySubscriberInterface {
  private readonly logger = new Logger(resolveModule(fileURLToPath(import.meta.url), this.constructor.name));

  constructor() {
    this.logger.log('init ...');

    PubSubHelper.subscribe<CleanCacheType>(PubSubChannels.dataloader).subscribe(({ action, payload }) => {
      this.logger.debug(`sub ${r({ action, payload })}`);
      CacheHelper.clear(payload);
    });
  }

  beforeInsert(event: InsertEvent<BaseEntity>): Promise<any> | void {
    safeReload(event.metadata, event.entity);
    validateObjectSync(event.entity);
  }

  beforeRemove(event: RemoveEvent<BaseEntity>): Promise<any> | void {}

  beforeUpdate(event: UpdateEvent<BaseEntity>): Promise<any> | void {
    safeReload(event.metadata, event.entity);
    validateObjectSync(event.entity);
  }

  afterInsert(event: InsertEvent<BaseEntity>): Promise<any> | void {
    CacheHelper.clear({ key: event.metadata.name });
  }

  afterLoad(entity: BaseEntity, event?: LoadEvent<BaseEntity>): Promise<any> | void {
    safeReload(event.metadata, entity);
  }

  afterRemove(event: RemoveEvent<BaseEntity>): Promise<any> | void {
    if (!event.entity) return;

    const id = _.get(event.entity, 'id') ?? _.get(event.entity, 'uuid');
    CacheHelper.pubClear({ key: event.metadata.name, id });
  }

  afterUpdate(event: UpdateEvent<BaseEntity>): Promise<any> | void {
    if (!event.entity) return;

    const id = _.get(event.entity, 'id') ?? _.get(event.entity, 'uuid');
    CacheHelper.pubClear({ key: event.metadata.name, id });
  }
}
