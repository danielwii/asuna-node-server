import { Logger } from '@nestjs/common';
import * as _ from 'lodash';
import { getConnection, getRepository, ObjectType } from 'typeorm';
import * as util from 'util';

import { parseFields, Profile } from '../helper';
import { DBHelper } from './db.helper';
import { ErrorException } from '../base';

const logger = new Logger('DBService');

export class DBService {
  repo<Entity>(entity: ObjectType<Entity> | string) {
    if (_.isString(entity)) {
      const entityMetadata = getConnection().entityMetadatas.find(metadata => {
        if (DBHelper.isValidEntity(metadata)) {
          return (metadata.target as any).entityInfo.name === entity;
        }
      });
      if (entityMetadata) {
        return getRepository(entityMetadata.target);
      }
      throw new ErrorException('Repository', `no valid repository for '${entity}' founded...`);
    } else {
      return getRepository(entity);
    }
  }

  repos() {
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
    const repository = this.repo(opts.entity);
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
