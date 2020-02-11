import * as _ from 'lodash';
import { EntitySubscriberInterface, EventSubscriber } from 'typeorm';
import { LoadEvent } from 'typeorm/subscriber/event/LoadEvent';
import { r } from '../common/helpers/utils';
import { LoggerFactory } from '../common/logger';
import { DBHelper } from '../core/db';
import { TenantService } from './tenant.service';

const logger = LoggerFactory.getLogger('TenantSubscriber');

@EventSubscriber()
export class TenantSubscriber implements EntitySubscriberInterface {
  async afterLoad(entity: any, event?: LoadEvent<any>): Promise<any> {
    if (['kv__pairs', 'auth__users', 'auth__roles', 'wx__users'].includes(entity.constructor?.entityInfo?.name)) {
      return;
    }
    if (entity?.tenantId || event.entity?.tenantId) {
      return;
    }
    const properties = DBHelper.getPropertyNamesByMetadata(event.metadata);
    if (properties.includes('tenantId')) {
      let loaded = entity || event.entity;

      if (!_.has(entity, 'tenantId')) {
        loaded = await (event.metadata.target as any).findOne(entity.id, { select: ['id', 'tenantId'] });
        // const reloaded = await event.manager.createQueryBuilder('entity')
        // const reloaded = await entity.reload();
        // logger.log(`afterLoad reloaded: ${r(loaded)}`);
      }

      if (loaded.tenantId) {
        return;
      }

      logger.log(`afterLoad ${r({ entity, properties, loaded })}`);
      TenantService.populate(loaded);
    }
  }

  // afterUpdate(event: UpdateEvent<any>): Promise<any> | void {
  //   logger.log(`afterUpdate ${r(event.entity.constructor)}`);
  //   if (['kv__pairs', 'auth__users', 'auth__roles', 'wx__users'].includes(event.entity.constructor?.entityInfo?.name)) {
  //     return;
  //   }
  //   TenantService.populate(event.entity);
  // }
  // afterInsert(event: InsertEvent<any>): Promise<any> | void {
  //   logger.log(`afterInsert ${r(event.entity.constructor)}`);
  //   if (['kv__pairs', 'auth__users', 'auth__roles', 'wx__users'].includes(event.entity.constructor?.entityInfo?.name)) {
  //     return;
  //   }
  //   TenantService.populate(event.entity);
  // }
}
