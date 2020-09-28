import * as _ from 'lodash';
import { r } from '../common/helpers';
import { LoggerFactory } from '../common/logger';
import { DBCacheCleaner } from '../core/db';

const logger = LoggerFactory.getLogger('QueryResolver');

export class QueryResolver {
  public constructor(entities) {
    const keys = Object.getOwnPropertyNames(this.constructor.prototype).filter((name) => name !== 'constructor');
    logger.debug(`init ... ${r({ keys })}`);
    if (_.isArray(entities)) {
      _.forEach(entities, (Entity) => _.forEach(keys, (key) => DBCacheCleaner.regTrigger(Entity, key)));
    } else {
      _.forEach(keys, (key) => DBCacheCleaner.regTrigger(entities, key));
    }
  }
}
