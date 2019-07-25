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
import { deserializeSafely, validateObjectSync } from '../../common/helpers';
import { dataLoaderCleaner } from '../../dataloader';
import { LoggerFactory } from '../../logger';
import { Hermes } from './hermes';

const logger = LoggerFactory.getLogger('EntitySubscriber');

export class BeforeAfterInsertPayload<T extends BaseEntity> {
  readonly entity: T;
  readonly updatedColumns: T;
  readonly name: string;
  readonly tableName: string;

  constructor(o: BeforeAfterInsertPayload<T>) {
    Object.assign(this, deserializeSafely(BeforeAfterInsertPayload, o));
  }
}

@EventSubscriber()
export class EntitySubscriber implements EntitySubscriberInterface {
  constructor() {
    logger.log('init ...');
  }

  afterInsert(event: InsertEvent<BaseEntity>): Promise<any> | void {
    // tslint:disable-next-line:max-line-length
    // logger.debug(`afterInsert ${idx(event, _ => _.entity.constructor.name)} ${r(event.entity)}`);
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
    //   `afterRemove ${idx(event, _ => _.entity.constructor.name)} ${r({
    //     entity: event.entity,
    //     id: event.entityId,
    //   })}`,
    // );
  }

  afterUpdate(event: UpdateEvent<BaseEntity>): Promise<any> | void {
    // logger.debug(
    //   `afterUpdate ${idx(event, _ => _.entity.constructor.name)} ${r({
    //     entity: event.entity,
    //     updatedColumns: diff(event.entity, event.databaseEntity),
    //     name: event.metadata.name,
    //     tableName: event.metadata.tableName,
    //   })}`,
    // );
    if (!event.entity) {
      return;
    }

    Hermes.emit(EntitySubscriber.name, 'entity.afterUpdate', {
      entity: event.entity,
      updatedColumns: diff(event.entity, event.databaseEntity),
      name: event.metadata.name,
      tableName: event.metadata.tableName,
    });
    dataLoaderCleaner.clear(idx(event, _ => _.entity.constructor.name), _.get(event.entity, 'id'));
  }

  beforeInsert(event: InsertEvent<BaseEntity>): Promise<any> | void {
    // tslint:disable-next-line:max-line-length
    // logger.debug(`beforeInsert ${idx(event, _ => _.entity.constructor.name)} ${r(event.entity)}`);
    validateObjectSync(event.entity);
  }

  beforeRemove(event: RemoveEvent<BaseEntity>): Promise<any> | void {
    // logger.debug(
    //   `beforeRemove ${idx(event, _ => _.entity.constructor.name)} ${r({
    //     entity: event.entity,
    //     id: event.entityId,
    //   })}`,
    // );
  }

  beforeUpdate(event: UpdateEvent<BaseEntity>): Promise<any> | void {
    // logger.debug(
    //   `beforeUpdate ${idx(event, _ => _.entity.constructor.name)} ${r({
    //     entity: event.entity,
    //     updatedColumns: diff(event.entity, event.databaseEntity),
    //     name: event.metadata.name,
    //     tableName: event.metadata.tableName,
    //   })}`,
    // );
    validateObjectSync(event.entity);
  }
}
