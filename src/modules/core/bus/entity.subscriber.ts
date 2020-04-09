import * as _ from 'lodash';
import { BaseEntity, EntitySubscriberInterface, EventSubscriber, InsertEvent, RemoveEvent, UpdateEvent } from 'typeorm';
import { EntityMetadata } from 'typeorm/metadata/EntityMetadata';
import { LoadEvent } from 'typeorm/subscriber/event/LoadEvent';
import { CacheHelper, CleanCacheType } from '../../cache';
import { MetaInfoOptions } from '../../common/decorators';
import { r, validateObjectSync } from '../../common/helpers';
import { LoggerFactory } from '../../common/logger';
import { PubSubChannels, PubSubHelper } from '../../pub-sub/pub-sub.helper';
import { ColumnType, safeReloadJSON } from '../helpers';

const logger = LoggerFactory.getLogger('EntitySubscriber');

const safeReload = (metadata: EntityMetadata, entity): void => {
  if (!_.isObject(entity)) return;

  const { info }: { info: { [key: string]: MetaInfoOptions } } = (metadata.target as Function).prototype;
  metadata.columns.forEach((column) => {
    if (column.type === ColumnType.JSON) {
      // const entityInfo = (column.target as any).entityInfo as MetaInfoBaseOptions;
      const defaultValue = _.cond([
        [_.matches('json-array'), _.constant([])],
        [_.matches('json-map'), _.constant({})],
        [_.stubTrue, _.constant(null)],
      ])(info[column.propertyName]?.safeReload);
      safeReloadJSON(entity as any, column.propertyName, defaultValue);
    }
  });
};

@EventSubscriber()
export class EntitySubscriber implements EntitySubscriberInterface {
  constructor() {
    logger.log('init ...');

    PubSubHelper.subscribe<CleanCacheType>(PubSubChannels.dataloader).subscribe(({ action, payload }) => {
      logger.verbose(`sub ${r({ action, payload })}`);
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
