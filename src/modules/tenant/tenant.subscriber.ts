import * as _ from 'lodash';
import { EntitySubscriberInterface, EventSubscriber, InsertEvent, UpdateEvent } from 'typeorm';
import { LoadEvent } from 'typeorm/subscriber/event/LoadEvent';
import { r } from '../common/helpers/utils';
import { LoggerFactory } from '../common/logger';
import { DBHelper } from '../core/db';
import { TenantHelper } from './tenant.helper';
import { TenantService } from './tenant.service';

const logger = LoggerFactory.getLogger('TenantSubscriber');

@EventSubscriber()
export class TenantSubscriber implements EntitySubscriberInterface {
  async handleTenant(entity, metadata) {
    const config = await TenantHelper.getConfig();
    if (!config.enabled && !config.firstModelBind) return;

    const entityInfo = (metadata.target as any)?.entityInfo;
    if (['kv__pairs', 'auth__users', 'auth__roles', 'wx__users', config.firstModelName].includes(entityInfo?.name)) {
      return;
    }

    if (entity?.tenantId) {
      return;
    }
    const properties = DBHelper.getPropertyNamesByMetadata(metadata);
    if (properties.includes('tenantId')) {
      let loaded = entity;

      if (!_.has(entity, 'tenantId')) {
        loaded = await (metadata.target as any).findOne(entity.id, { select: ['id', 'tenantId'] });
        // const reloaded = await event.manager.createQueryBuilder('entity')
        // const reloaded = await entity.reload();
        // logger.log(`afterLoad reloaded: ${r(loaded)}`);
      }

      if (loaded.tenantId) {
        return;
      }

      logger.log(`afterLoad ${entity.id} ${r({ properties, loaded })}`);
      TenantService.populate(loaded);
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-empty-function
  async afterLoad(entity: any, event?: LoadEvent<any>): Promise<any> {}

  afterUpdate(event: UpdateEvent<any>): Promise<any> | void {
    if (event.entity) {
      logger.log(`afterUpdate ${(event.metadata.target as any)?.entityInfo?.name} ${r(event.entity)}`);
      this.handleTenant(event.entity, event.metadata);
    }
  }
  afterInsert(event: InsertEvent<any>): Promise<any> | void {
    if (event.entity) {
      logger.log(`afterInsert ${(event.metadata.target as any)?.entityInfo?.name} ${r(event.entity)}`);
      this.handleTenant(event.entity, event.metadata);
    }
  }
}
