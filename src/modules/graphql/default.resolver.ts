import { LoggerFactory } from '@danielwii/asuna-helper/dist/logger';
import { r } from '@danielwii/asuna-helper/dist/serializer';

import _ from 'lodash';

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
