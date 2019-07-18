import { Logger } from '@nestjs/common';
import { diff } from 'jsondiffpatch';
import * as _ from 'lodash';
import {
  EntitySubscriberInterface,
  EventSubscriber,
  getRepository,
  InsertEvent,
  RemoveEvent,
  UpdateEvent,
} from 'typeorm';
import { r } from '../common/helpers';
import { AuditService } from './audit.service';

const logger = new Logger('AuditSubscriber');

@EventSubscriber()
export class AuditSubscriber implements EntitySubscriberInterface {
  private map = new Map();
  private auditService: AuditService = new AuditService();

  constructor() {
    logger.log('init ...');
  }

  afterInsert(event: InsertEvent<any>) {
    // console.log('afterInsert', event.entity, idx(event, _ => _.entity.constructor.name));
    if (!event.entity || event.entity.constructor.name === 'Object') return;

    logger.log(`call afterInsert... ${event.entity.constructor.name} ${r(event.entity)}`);
    this.auditService
      .addRecord(
        'entity',
        'insert',
        { type: event.entity.constructor.name },
        null,
        event.entity,
        null,
      )
      .catch(reason => logger.warn(r(reason)));
  }

  async beforeUpdate(event: UpdateEvent<any>): Promise<any> {
    // console.log('beforeUpdate', event.entity, idx(event, _ => _.entity.constructor.name));
    if (!event.entity || event.entity.constructor.name === 'Object') return;

    const entity = await getRepository(event.entity.constructor.name).findOne(event.entity.id, {
      loadRelationIds: true,
    });
    if (entity) {
      logger.log(`call beforeUpdate... ${event.entity.constructor.name} ${r(event.entity)}`);
      this.map.set(`${event.entity.name}-${event.entity.id}`, { ...entity });
    }
  }

  afterUpdate(event: InsertEvent<any>) {
    // console.log('afterUpdate', event.entity, idx(event, _ => _.entity.constructor.name));
    if (!event.entity || event.entity.constructor.name === 'Object') return;

    const from = this.map.get(`${event.entity.name}-${event.entity.id}`);
    logger.log(
      `call afterUpdate... ${event.entity.constructor.name} ${r({
        diff: diff(from, event.entity),
      })}`,
    );
    this.auditService
      .addRecord(
        'entity',
        'update',
        { type: event.entity.constructor.name, id: _.get(event.entity, 'id') },
        from,
        event.entity,
        null,
      )
      .then(() => this.map.delete(`${event.entity.name}-${event.entity.id}`))
      .catch(reason => logger.warn(r(reason)));
  }

  afterRemove(event: RemoveEvent<any>) {
    // console.log('afterRemove', event.entity, idx(event, _ => _.entity.constructor.name));
    if (!event.entity || event.entity.constructor.name === 'Object') return;

    logger.log(`call afterRemove... ${event.entity.constructor.name} ${r(event.entity)}`);
    this.auditService
      .addRecord(
        'entity',
        'remove',
        { type: event.entity.constructor.name, id: _.get(event.entity, 'id') },
        event.entity,
        null,
        null,
      )
      .catch(reason => logger.warn(r(reason)));
  }
}
