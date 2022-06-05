import { Injectable } from '@nestjs/common';

import { LoggerFactory } from '@danielwii/asuna-helper/dist/logger/factory';
import { r } from '@danielwii/asuna-helper/dist/serializer';

import { DataSource, Repository } from 'typeorm';

import { Profile } from '../../common';
import { DBHelper, parseFields } from './db.helper';

const logger = LoggerFactory.getLogger('DBService');

@Injectable()
export class DBService {
  constructor(private readonly dataSource: DataSource) {}

  repos(): Repository<any>[] {
    return this.dataSource.entityMetadatas
      .filter((metadata) => DBHelper.isValidEntity(metadata))
      .map((metadata) => this.dataSource.getRepository<any>(metadata.target));
  }

  get(opts: {
    entity: string;
    id: number;
    profile?: Profile;
    fields?: string;
    relationsStr?: string | string[];
  }): Promise<any> {
    const repository = DBHelper.repo(opts.entity);
    const parsedFields = parseFields(opts.fields);

    logger.log(`get ${r({ opts, parsedFields })}`);

    const queryBuilder = repository.createQueryBuilder(opts.entity);

    DBHelper.wrapParsedFields(opts.entity, { queryBuilder, parsedFields });
    DBHelper.wrapProfile(opts.entity, queryBuilder, repository, opts.profile, opts.relationsStr, parsedFields, null);

    queryBuilder.whereInIds(opts.id);

    return queryBuilder.getOne();
  }
}
