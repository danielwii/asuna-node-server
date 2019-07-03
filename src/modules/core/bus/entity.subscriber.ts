import { Logger } from '@nestjs/common';
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
import { dataLoaderCleaner } from '../../dataloader';
import { Hermes } from './hermes';

const logger = new Logger('EntitySubscriber');

@EventSubscriber()
export class EntitySubscriber implements EntitySubscriberInterface {
  constructor() {
    logger.log('init ...');
  }

  afterInsert(event: InsertEvent<BaseEntity>): Promise<any> | void {
    logger.log(
      `afterInsert ${idx(event, _ => _.entity.constructor.name)} ${JSON.stringify(event.entity)}`,
    );
    return undefined;
  }

  afterLoad(entity: BaseEntity): Promise<any> | void {
    // logger.log(`afterLoad ${entity.constructor.name} ${JSON.stringify(entity)}`);
    return undefined;
  }

  afterRemove(event: RemoveEvent<BaseEntity>): Promise<any> | void {
    logger.log(
      `afterRemove ${idx(event, _ => _.entity.constructor.name)} ${JSON.stringify({
        entity: event.entity,
        id: event.entityId,
      })}`,
    );
    return undefined;
  }

  afterUpdate(event: UpdateEvent<BaseEntity>): Promise<any> | void {
    logger.log(
      `afterUpdate ${idx(event, _ => _.entity.constructor.name)} ${JSON.stringify({
        entity: event.entity,
        updatedColumns: diff(event.entity, event.databaseEntity),
        // updatedRelations: event.updatedRelations,
      })}`,
    );
    Hermes.emit(EntitySubscriber.name, 'entity.afterUpdate', {
      entity: event.entity,
      updatedColumns: diff(event.entity, event.databaseEntity),
      // updatedRelations: event.updatedRelations,
    });
    dataLoaderCleaner.clear(idx(event, _ => _.entity.constructor.name), _.get(event.entity, 'id'));
    return undefined;
  }

  beforeInsert(event: InsertEvent<BaseEntity>): Promise<any> | void {
    logger.log(
      `beforeInsert ${idx(event, _ => _.entity.constructor.name)} ${JSON.stringify(event.entity)}`,
    );
    return undefined;
  }

  beforeRemove(event: RemoveEvent<BaseEntity>): Promise<any> | void {
    logger.log(
      `beforeRemove ${idx(event, _ => _.entity.constructor.name)} ${JSON.stringify({
        entity: event.entity,
        id: event.entityId,
      })}`,
    );
    return undefined;
  }

  beforeUpdate(event: UpdateEvent<BaseEntity>): Promise<any> | void {
    logger.log(
      `beforeUpdate ${idx(event, _ => _.entity.constructor.name)} ${JSON.stringify({
        entity: event.entity,
        updatedColumns: diff(event.entity, event.databaseEntity),
        // updatedRelations: event.updatedRelations,
      })}`,
    );
    return undefined;
  }
}
