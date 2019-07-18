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
import { r, validateObjectSync } from '../../common/helpers';
import { dataLoaderCleaner } from '../../dataloader';
import { Hermes } from './hermes';

const logger = new Logger('EntitySubscriber');

@EventSubscriber()
export class EntitySubscriber implements EntitySubscriberInterface {
  constructor() {
    logger.log('init ...');
  }

  afterInsert(event: InsertEvent<BaseEntity>): Promise<any> | void {
    logger.verbose(`afterInsert ${idx(event, _ => _.entity.constructor.name)} ${r(event.entity)}`);
    return undefined;
  }

  afterLoad(entity: BaseEntity): Promise<any> | void {
    // logger.verbose(`afterLoad ${entity.constructor.name} ${r(entity)}`);
    return undefined;
  }

  afterRemove(event: RemoveEvent<BaseEntity>): Promise<any> | void {
    logger.verbose(
      `afterRemove ${idx(event, _ => _.entity.constructor.name)} ${r({
        entity: event.entity,
        id: event.entityId,
      })}`,
    );
    return undefined;
  }

  afterUpdate(event: UpdateEvent<BaseEntity>): Promise<any> | void {
    logger.verbose(
      `afterUpdate ${idx(event, _ => _.entity.constructor.name)} ${r({
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
    logger.verbose(`beforeInsert ${idx(event, _ => _.entity.constructor.name)} ${r(event.entity)}`);
    validateObjectSync(event.entity);
    return undefined;
  }

  beforeRemove(event: RemoveEvent<BaseEntity>): Promise<any> | void {
    logger.verbose(
      `beforeRemove ${idx(event, _ => _.entity.constructor.name)} ${r({
        entity: event.entity,
        id: event.entityId,
      })}`,
    );
    return undefined;
  }

  beforeUpdate(event: UpdateEvent<BaseEntity>): Promise<any> | void {
    logger.verbose(
      `beforeUpdate ${idx(event, _ => _.entity.constructor.name)} ${r({
        entity: event.entity,
        updatedColumns: diff(event.entity, event.databaseEntity),
        // updatedRelations: event.updatedRelations,
      })}`,
    );
    validateObjectSync(event.entity);
    return undefined;
  }
}
