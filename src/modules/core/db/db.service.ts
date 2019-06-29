import { Logger } from '@nestjs/common';
import * as _ from 'lodash';
import { getConnection, getRepository, ObjectType, Repository } from 'typeorm';
import * as util from 'util';

import { parseFields, Profile } from '../../helper';
import { DBHelper } from './db.helper';
import { ErrorException } from '../base';

const logger = new Logger('DBService');

export class DBService {
  repos(): Repository<any>[] {
    return getConnection()
      .entityMetadatas.filter(metadata => DBHelper.isValidEntity(metadata))
      .map(metadata => getRepository(metadata.target));
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

    logger.log(`get ${util.inspect({ opts, parsedFields }, { colors: true })}`);

    const queryBuilder = repository.createQueryBuilder(opts.entity);

    DBHelper.wrapParsedFields(opts.entity, { queryBuilder, parsedFields });
    DBHelper.wrapProfile(
      opts.entity,
      queryBuilder,
      repository,
      opts.profile,
      opts.relationsStr,
      parsedFields,
      null,
    );

    queryBuilder.whereInIds(opts.id);

    return queryBuilder.getOne();
  }
}
