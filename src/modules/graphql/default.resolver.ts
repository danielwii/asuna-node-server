import * as _ from 'lodash';
import { BaseEntity } from 'typeorm';
import { r } from '../common/helpers';
import { LoggerFactory } from '../common/logger';
import { DBCacheCleaner } from '../core/db';

const logger = LoggerFactory.getLogger('QueryResolver');

export class QueryResolver {
  constructor(Entity: typeof BaseEntity) {
    const keys = Object.getOwnPropertyNames(this.constructor.prototype).filter(name => name !== 'constructor');
    logger.verbose(`init ... ${r({ keys })}`);
    _.forEach(keys, key => DBCacheCleaner.regTrigger(Entity, key));
  }
}
