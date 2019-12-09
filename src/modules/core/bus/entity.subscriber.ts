import idx from 'idx';
import { diff } from 'jsondiffpatch';
import * as _ from 'lodash';
import {
  BaseEntity,
  EntitySubscriberInterface,
  EventSubscriber,
  InsertEvent,
  RemoveEvent,
  UpdateEvent,
} from 'typeorm';
import { deserializeSafely, r, validateObjectSync } from '../../common/helpers';
import { LoggerFactory } from '../../common/logger';
import { dataLoaderCleaner } from '../../dataloader';
import { jsonType, safeReloadJSON } from '../helpers';
import { Hermes } from './hermes';

const logger = LoggerFactory.getLogger('EntitySubscriber');

export class BeforeAfterInsertPayload<T extends BaseEntity> {
  public readonly entity: T;

  public readonly updatedColumns: T;

  public readonly name: string;

  public readonly tableName: string;

  public constructor(o: BeforeAfterInsertPayload<T>) {
    Object.assign(this, deserializeSafely(BeforeAfterInsertPayload, o));
  }
}

@EventSubscriber()
export class EntitySubscriber implements EntitySubscriberInterface {
  constructor() {
    logger.log('init ...');
  }

  afterInsert(event: InsertEvent<BaseEntity>): Promise<any> | void {
    /*
    Hermes.emit(
      EntitySubscriber.name,
      'entity.afterInsert',
      new BeforeAfterInsertPayload({
        entity: event.entity,
        updatedColumns: event.entity,
        name: event.metadata.name,
        tableName: event.metadata.tableName,
      }),
    );
*/
  }

  afterLoad(entity: BaseEntity): Promise<any> | void {
    // logger.debug(`afterLoad ${entity.constructor.name} ${r(entity)}`);
  }

  afterRemove(event: RemoveEvent<BaseEntity>): Promise<any> | void {
    // logger.debug(
    //   `afterRemove ${(event, _ => _.entity.constructor.name)} ${r({
    //     entity: event.entity,
    //     id: event.entityId,
    //   })}`,
    // );
  }

  afterUpdate(event: UpdateEvent<BaseEntity>): Promise<any> | void {
    // logger.debug(
    //   `afterUpdate ${(event, _ => _.entity.constructor.name)} ${r({
    //     entity: event.entity,
    //     updatedColumns: diff(event.entity, event.databaseEntity),
    //     name: event.metadata.name,
    //     tableName: event.metadata.tableName,
    //   })}`,
    // );
    if (!event.entity) {
      return;
    }

    /*
    Hermes.emit(EntitySubscriber.name, 'entity.afterUpdate', {
      entity: event.entity,
      updatedColumns: diff(event.entity, event.databaseEntity),
      name: event.metadata.name,
      tableName: event.metadata.tableName,
    });
*/
    dataLoaderCleaner.clear(event?.entity?.constructor?.name, _.get(event.entity, 'id'));
  }

  beforeInsert(event: InsertEvent<BaseEntity>): Promise<any> | void {
    // logger.debug(`beforeInsert ${(event, _ => _.entity.constructor.name)} ${r(event.entity)}`);
    event.metadata.columns.forEach(column => {
      if (column.type === jsonType()) {
        safeReloadJSON(event.entity as any, column.propertyName);
      }
    });
    validateObjectSync(event.entity);
  }

  beforeRemove(event: RemoveEvent<BaseEntity>): Promise<any> | void {
    // logger.debug(
    //   `beforeRemove ${(event, _ => _.entity.constructor.name)} ${r({
    //     entity: event.entity,
    //     id: event.entityId,
    //   })}`,
    // );
  }

  beforeUpdate(event: UpdateEvent<BaseEntity>): Promise<any> | void {
    // logger.debug(
    //   `beforeUpdate ${(event, _ => _.entity.constructor.name)} ${r({
    //     entity: event.entity,
    //     updatedColumns: diff(event.entity, event.databaseEntity),
    //     name: event.metadata.name,
    //     tableName: event.metadata.tableName,
    //   })}`,
    // );
    event.metadata.columns.forEach(column => {
      if (column.type === jsonType()) {
        safeReloadJSON(event.entity as any, column.propertyName);
      }
    });
    validateObjectSync(event.entity);
  }
}
