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
import { r, validateObjectSync } from '../../common/helpers';
import { dataLoaderCleaner } from '../../dataloader';
import { LoggerFactory } from '../../logger';
import { Hermes } from './hermes';

const logger = LoggerFactory.getLogger('EntitySubscriber');

@EventSubscriber()
export class EntitySubscriber implements EntitySubscriberInterface {
  constructor() {
    logger.log('init ...');
  }

  afterInsert(event: InsertEvent<BaseEntity>): Promise<any> | void {
    // tslint:disable-next-line:max-line-length
    // logger.verbose(`afterInsert ${idx(event, _ => _.entity.constructor.name)} ${r(event.entity)}`);
  }

  afterLoad(entity: BaseEntity): Promise<any> | void {
    // logger.verbose(`afterLoad ${entity.constructor.name} ${r(entity)}`);
  }

  afterRemove(event: RemoveEvent<BaseEntity>): Promise<any> | void {
    // logger.verbose(
    //   `afterRemove ${idx(event, _ => _.entity.constructor.name)} ${r({
    //     entity: event.entity,
    //     id: event.entityId,
    //   })}`,
    // );
  }

  afterUpdate(event: UpdateEvent<BaseEntity>): Promise<any> | void {
    // logger.verbose(
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
    // logger.verbose(`beforeInsert ${idx(event, _ => _.entity.constructor.name)} ${r(event.entity)}`);
    validateObjectSync(event.entity);
  }

  beforeRemove(event: RemoveEvent<BaseEntity>): Promise<any> | void {
    // logger.verbose(
    //   `beforeRemove ${idx(event, _ => _.entity.constructor.name)} ${r({
    //     entity: event.entity,
    //     id: event.entityId,
    //   })}`,
    // );
  }

  beforeUpdate(event: UpdateEvent<BaseEntity>): Promise<any> | void {
    // logger.verbose(
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
