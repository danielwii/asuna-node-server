import { Injectable } from '@nestjs/common';
import * as _ from 'lodash';
import { EntityTarget, getRepository } from 'typeorm';

import { r } from '../common/helpers';
import { LoggerFactory } from '../common/logger';
import { DBHelper } from '../core/db';

const logger = LoggerFactory.getLogger('SortService');

export interface Sort {
  id: number;
  positions: number[];
  type: string;
}

/**
 * const SortServiceProvider: Provider = {
 *   provide: 'SortService',
 *   useFactory: (connection: Connection) => {
 *     return new SortService(connection, Sort);
 *   },
 *   inject: [Connection],
 * };
 */
@Injectable()
export class SortService {
  public constructor(private readonly Sort: EntityTarget<any>) {}

  public async findItems(sort: Sort): Promise<any[]> {
    let items = [];
    const { positions } = sort;
    if (sort.id && sort.type) {
      const relation = sort.type.toLowerCase();
      logger.debug(`resolve ${relation} for sorts.`);
      const withRelation = await getRepository<any>(this.Sort).findOne({
        where: { id: sort.id },
        relations: [relation],
        cache: true,
      });
      items = withRelation[relation];
      logger.debug(`loaded ${items.length} items.`);

      const primaryKey = _.first(DBHelper.getPrimaryKeys(DBHelper.repo(relation)));
      items.sort((a: any, b: any) => positions.indexOf(a[primaryKey]) - positions.indexOf(b[primaryKey]));
    } else {
      logger.warn(`sort not available: ${r(sort)}`);
    }

    return items;
  }
}
