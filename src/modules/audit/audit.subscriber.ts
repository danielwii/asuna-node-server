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
import { LoggerFactory } from '../common/logger';
import { ConfigKeys, configLoader } from '../config';
import { AuditService } from './audit.service';

const logger = LoggerFactory.getLogger('AuditSubscriber');

@EventSubscriber()
export class AuditSubscriber implements EntitySubscriberInterface {
  private map = new Map();

  private auditService: AuditService = new AuditService();

  private enabled = configLoader.loadBoolConfig(ConfigKeys.AUDIT, false);

  constructor() {
    logger.log(`init ... audit: ${this.enabled}`);
  }

  afterInsert(event: InsertEvent<any>) {
    if (!this.enabled) return;
    if (!event.entity || event.entity.constructor.name === 'Object') return;

    // logger.debug(`call afterInsert... ${event.entity.constructor.name} ${r(event.entity)}`);
    this.auditService
      .addRecord(
        'entity',
        'insert',
        { type: event.entity.constructor.name },
        null,
        event.entity,
        null,
      )
      .catch(error => logger.warn(r(error)));
  }

  async beforeUpdate(event: UpdateEvent<any>): Promise<any> {
    if (!this.enabled) return;
    // console.log('beforeUpdate', event.entity, (event, _ => _.entity.constructor.name));
    if (!event.entity || event.entity.constructor.name === 'Object') return;

    const entity = await getRepository(event.entity.constructor.name).findOne(event.entity.id, {
      loadRelationIds: true,
    });
    if (entity) {
      // logger.debug(`call beforeUpdate... ${event.entity.constructor.name} ${r(event.entity)}`);
      this.map.set(`${event.entity.name}-${event.entity.id}`, { ...entity as any });
    }
  }

  afterUpdate(event: InsertEvent<any>) {
    if (!this.enabled) return;
    // console.log('afterUpdate', event.entity, (event, _ => _.entity.constructor.name));
    if (!event.entity || event.entity.constructor.name === 'Object') return;

    const from = this.map.get(`${event.entity.name}-${event.entity.id}`);
    // logger.debug(
    //   `call afterUpdate... ${event.entity.constructor.name} ${r({
    //     diff: diff(from, event.entity),
    //   })}`,
    // );
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
      .catch(error => logger.warn(r(error)));
  }

  afterRemove(event: RemoveEvent<any>) {
    if (!this.enabled) return;
    // console.log('afterRemove', event.entity, (event, _ => _.entity.constructor.name));
    if (!event.entity || event.entity.constructor.name === 'Object') return;

    // logger.debug(`call afterRemove... ${event.entity.constructor.name} ${r(event.entity)}`);
    this.auditService
      .addRecord(
        'entity',
        'remove',
        { type: event.entity.constructor.name, id: _.get(event.entity, 'id') },
        event.entity,
        null,
        null,
      )
      .catch(error => logger.warn(r(error)));
  }
}
