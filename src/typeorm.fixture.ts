import * as _ from 'lodash';
import { FindOneOptions, FindOptionsUtils, JoinOptions, ObjectLiteral } from 'typeorm';
import { FindManyOptions } from 'typeorm/find-options/FindManyOptions';
import { r } from './modules/common/helpers';
import { LoggerFactory } from './modules/common/logger';

const logger = LoggerFactory.getLogger('FindOptionsFixture');

const oldApplyOptionsToQueryBuilder = FindOptionsUtils.applyOptionsToQueryBuilder;

export type FindOptionsFixture<T> = (FindOneOptions<T> | FindManyOptions<T>) & {
  join?: JoinOptions & { options?: { [key: string]: { condition?: string; parameters?: ObjectLiteral } } };
};

FindOptionsUtils.applyOptionsToQueryBuilder = <T>(qb, options: FindOptionsFixture<T>) => {
  const join = options?.join;

  if (join) {
    logger.verbose(`apply join ${r(join)}`);
    if (join.leftJoin)
      Object.keys(join.leftJoin).forEach((key) => {
        const extra = join.options?.[key] || {};
        qb.leftJoin(join.leftJoin[key], key, extra.condition, extra.parameters);
      });

    if (join.innerJoin)
      Object.keys(join.innerJoin).forEach((key) => {
        const extra = join.options?.[key] || {};
        qb.innerJoin(join.innerJoin[key], key, extra.condition, extra.parameters);
      });

    if (join.leftJoinAndSelect)
      Object.keys(join.leftJoinAndSelect).forEach((key) => {
        const extra = join.options?.[key] || {};
        qb.leftJoinAndSelect(join.leftJoinAndSelect[key], key, extra.condition, extra.parameters);
      });

    if (join.innerJoinAndSelect)
      Object.keys(join.innerJoinAndSelect).forEach((key) => {
        const extra = join.options?.[key] || {};
        qb.innerJoinAndSelect(join.innerJoinAndSelect[key], key, extra.condition, extra.parameters);
      });
  }

  const extra = _.omit(options, 'join');
  logger.verbose(`apply extra ${r(options)}`);
  try {
    return oldApplyOptionsToQueryBuilder.bind(FindOptionsUtils)(qb, extra);
  } catch (e) {
    logger.error(`resolve sql error: ${r({ e, extra, sql: qb.getSql() })}`);
    throw e;
  }
};
