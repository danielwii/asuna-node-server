import { Injectable, Logger } from '@nestjs/common';

import { resolveModule } from '@danielwii/asuna-helper/dist/logger/factory';
import { r } from '@danielwii/asuna-helper/dist/serializer';

import _ from 'lodash';

import { DBHelper } from '../core/db';
import { AppDataSource } from '../datasource';

import type { EntityTarget } from 'typeorm';
import { fileURLToPath } from 'node:url';

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
  private readonly logger = new Logger(resolveModule(fileURLToPath(import.meta.url), this.constructor.name));

  public constructor(private readonly Sort: EntityTarget<any>) {}

  public async findItems(sort: Sort): Promise<any[]> {
    let items = [];
    const { positions } = sort;
    if (sort.id && sort.type) {
      const relation = sort.type.toLowerCase();
      this.logger.debug(`resolve ${relation} for sorts.`);
      const withRelation = await AppDataSource.dataSource.getRepository<any>(this.Sort).findOne({
        where: { id: sort.id },
        relations: [relation],
        cache: true,
      });
      items = withRelation[relation];
      this.logger.debug(`loaded ${items.length} items.`);

      const primaryKey = _.first(DBHelper.getPrimaryKeys(DBHelper.repo(relation)));
      items.sort((a: any, b: any) => positions.indexOf(a[primaryKey]) - positions.indexOf(b[primaryKey]));
    } else {
      this.logger.warn(`sort not available: ${r(sort)}`);
    }

    return items;
  }
}
