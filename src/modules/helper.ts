import { Logger } from '@nestjs/common';
import * as _ from 'lodash';
import * as R from 'ramda';
import {
  Any,
  Between,
  Equal,
  FindOperator,
  In,
  IsNull,
  LessThan,
  Like,
  MoreThan,
  Not,
  Raw,
} from 'typeorm';
import * as util from 'util';
import { Condition } from './decorators/meta.decorator';

const logger = new Logger('Helper');

export enum Profile {
  // TODO @deprecated this may cause a memory leak
  detail = 'detail',
  ids = 'ids',
}

/**
 * https://github.com/typeorm/typeorm/issues/1101
 * @param {string} value
 * @returns {any}
 */
export function parseWhere(value: string): string[] | FindOperator<any>[] | null {
  if (value) {
    try {
      const parsed = JSON.parse(value);
      return R.map(parseCondition)(parsed);
    } catch (e) {
      logger.warn(e);
    }
  }
  return null;
}

export function parseNormalWhereAndRelatedFields(
  where,
  repository,
): { normalWhere: any[]; relatedFields: string[] } {
  const allRelations = repository.metadata.relations.map(r => r.propertyName);
  let normalWhere = [];
  let relatedFields = [];
  _.each(where, (value, field) => {
    if (_.includes(allRelations, field)) {
      relatedFields.push(field);
    } else {
      normalWhere.push({ field, value });
    }
  });
  return { normalWhere, relatedFields };
}

function parseCondition(value: Condition) {
  if (_.has(value, '$and')) {
    return { $and: R.map(parseCondition)(value.$and) };
  }
  if (_.has(value, '$or')) {
    return { $or: R.map(parseCondition)(value.$or) };
  }

  if (_.has(value, '$like')) return Like(value.$like);
  if (_.has(value, '$notLike')) return Not(Like(value.$notLike));
  if (_.has(value, '$any')) return Any(value.$any);
  if (_.has(value, '$in')) return In(value.$in);
  if (_.has(value, '$notIn')) return Not(In(value.$notIn));
  if (_.has(value, '$between')) return Between(value.$between[0], value.$between[1]);
  if (_.has(value, '$eq')) return Equal(value.$eq);
  if (_.has(value, '$lt')) return LessThan(value.$lt);
  if (_.has(value, '$gt')) return MoreThan(value.$gt);
  if (_.has(value, '$raw')) return Raw(value.$raw);
  if (_.has(value, '$notNull')) return Not(IsNull());
  if (_.has(value, '$isNull')) return IsNull();
  if (_.has(value, '$not')) return Not(value.$not);
  if (_.isBoolean(value)) return value;
  logger.warn(`no handler found for ${util.inspect(value)}`);
  return value;
}

export function parseOrder(model: string, value: string) {
  return value
    ? _.assign(
        {},
        ..._.map(JSON.parse(value), (direction, key) => ({
          [`${model}.${key}`]: _.upperCase(direction),
        })),
      )
    : undefined;
}

/**
 * value 为 string 时按 `,` 拆分为数组
 * value 为 string[] 时直接返回
 * @param {string | string[]} value
 * @param map
 * @returns {string[] | undefined}
 */
export function parseListParam(
  value: string | string[],
  map?: (field: any) => any,
): string[] | any | undefined {
  const list = value
    ? _.isArray(value)
      ? (value as string[])
      : (value as string).split(',').map(_.trim)
    : undefined;
  return list && map ? R.map(map, list) : list;
}

export type ParsedFields = {
  fields: string[];
  relatedFieldsMap: object;
};

export function parseFields(value: string | string[], allRelations?: string[]): ParsedFields {
  const fields = parseListParam(value);
  const relatedFieldsMap = _.chain(fields)
    .filter(str => str.includes('.'))
    .filter(str => (allRelations ? allRelations.indexOf(str.split('.')[0]) > -1 : true))
    .reduce<string, any>((result, val) => {
      const subModel = val.split('.')[0];
      result[subModel] = [...(result[subModel] || []), val];
      fields.splice(fields.indexOf(val), 1);
      return result;
    }, {})
    .value();
  return { fields, relatedFieldsMap };
}
