import { Logger } from '@nestjs/common';
import * as _ from 'lodash';
import { getConnection, getRepository, ObjectType } from 'typeorm';
import * as util from 'util';
import { parseFields, Profile } from '../helper';
import { ErrorException } from './base.exceptions';
import { DBHelper } from './db.helper';

const logger = new Logger('DBService');

export class DBService {
  static isValidEntity(metadata): boolean {
    const isNotEntityInfo = _.isNil((metadata.target as any).entityInfo);
    const isRelation = _.includes(metadata.target as string, '__tr_');
    if (isNotEntityInfo && !isRelation) {
      logger.error(`Entity '${metadata.targetName}' must add @EntityMetaInfo on it.`);
      return false;
    }
    return !isRelation;
  }

  repo<Entity>(entity: ObjectType<Entity> | string) {
    if (_.isString(entity)) {
      const entityMetadata = getConnection().entityMetadatas.find(metadata => {
        if (DBService.isValidEntity(metadata)) {
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
      .entityMetadatas.filter(metadata => DBService.isValidEntity(metadata))
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

    DBHelper.wrapParsedFields(opts.entity, queryBuilder, parsedFields);
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
