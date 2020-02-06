import { EntitySubscriberInterface, EventSubscriber, UpdateEvent, InsertEvent } from 'typeorm';
import { LoadEvent } from 'typeorm/subscriber/event/LoadEvent';
import { LoggerFactory } from '../common/logger';
import { TenantService } from './tenant.service';
import { r } from '../common/helpers/utils';

const logger = LoggerFactory.getLogger('TenantSubscriber');

@EventSubscriber()
export class TenantSubscriber implements EntitySubscriberInterface {
  afterLoad(entity: any, event?: LoadEvent<any>): Promise<any> | void {
    // console.log(inspect(event, false, 1));
    if (['kv__pairs', 'auth__users', 'auth__roles', 'wx__users'].includes(entity.constructor?.entityInfo?.name)) {
      return;
    }
    // logger.log(`afterLoad ${r(entity)}`);
    TenantService.populate(entity || event.entity);
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
