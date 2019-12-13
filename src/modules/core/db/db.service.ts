import { getConnection, getRepository, Repository } from 'typeorm';
import { Profile, r } from '../../common';
import { LoggerFactory } from '../../common/logger';
import { DBHelper, parseFields } from './db.helper';

const logger = LoggerFactory.getLogger('DBService');

export class DBService {
  repos(): Repository<any>[] {
    return getConnection()
      .entityMetadatas.filter(metadata => DBHelper.isValidEntity(metadata))
      .map(metadata => getRepository<any>(metadata.target));
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
