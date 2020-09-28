import * as _ from 'lodash';
import { r } from '../common/helpers';
import { LoggerFactory } from '../common/logger';
import { DBCacheCleaner } from '../core/db';
import { BaseEntity } from 'typeorm';

const logger = LoggerFactory.getLogger('QueryResolver');

export class QueryResolver {
  public constructor(entities) {
    if (_.isArray(entities)) {
      _.forEach(entities, QueryResolver.regCleaner);
    } else {
      QueryResolver.regCleaner(entities);
    }
  }

  private static regCleaner(Entity: typeof BaseEntity) {
    const keys = Object.getOwnPropertyNames(this.constructor.prototype).filter((name) => name !== 'constructor');
    logger.debug(`init ... ${r({ keys })}`);
    _.forEach(keys, (key) => DBCacheCleaner.regTrigger(Entity, key));
  }
}
