import { Logger } from '@nestjs/common';

import { AsunaErrorCode, AsunaException, ErrorException } from '@danielwii/asuna-helper/dist/exceptions';
import { r } from '@danielwii/asuna-helper/dist/serializer';

import _ from 'lodash';
import fp from 'lodash/fp';
import * as R from 'ramda';
import {
  Any,
  BaseEntity,
  Between,
  EntityMetadata,
  Equal,
  FindOperator,
  In,
  IsNull,
  LessThan,
  Like,
  MoreThan,
  Not,
  ObjectType,
  QueryBuilder,
  Raw,
  Repository,
  SelectQueryBuilder,
} from 'typeorm';

import { Profile } from '../../common/helpers/normal';
import { AppDataSource } from '../../datasource';
import { AsunaContext } from '../context';

import type { Condition, EntityMetaInfoOptions, MetaInfoOptions } from '@danielwii/asuna-shared';
import type { ColumnMetadata } from 'typeorm/metadata/ColumnMetadata';
import type { RelationMetadata } from 'typeorm/metadata/RelationMetadata';
import type { Role } from '../auth/auth.entities';

export interface ColumnSchema {
  name: string;
  config?: {
    type?: any; // 字段类型
    primaryKey?: boolean; // 是否是主键
    nullable?: boolean;
    many?: boolean; // 是否在数据关联中处在多的一端
    relation?: 'ManyToOne' | 'ManyToMany' | 'OneToMany' | 'OneToOne';
    selectable?: string; // 关联的对象，用于拉取数据
    info?: MetaInfoOptions;
  };
}

export interface ModelNameObject {
  model: string;
  module: string;
  /**
   * 在数据库重的名称
   */
  dbName: string;
  /**
   * EntityInfo 注解的名称，约定上，应该是 module 和 name 的组合
   */
  entityName: string;
}

export type ParsedWhere = Record<string, ParsedCondition>;
export type ParsedWheres = ParsedWhere[];
export type ParsedWhereCondition = { field: string; value: ParsedCondition };
export type ParsedWhereConditions = ParsedWhereCondition[];

/**
 * https://github.com/typeorm/typeorm/issues/1101
 * @param {string} value
 * @returns {any}
 */
export function parseWhere(value: string): ParsedWhere | ParsedWheres {
  if (value) {
    try {
      const parsed = JSON.parse(value);

      /*
      const condition = R.ifElse(
        _.isArray,
        (v) => _.map(v, R.map(parseCondition)),
        (v) => R.map(parseCondition)(v),
      )(parsed);
*/

      if (_.isArray(parsed)) {
        const condition = _.filter(
          _.map(parsed, (v) => _.omitBy(_.mapValues(v, parseCondition), _.isNil)),
          _.negate(_.isEmpty),
        );
        Logger.debug(`array condition is ${r({ parsed, condition })}`);
        return condition;
      } else {
        // const condition = _.filter(_.omitBy(_.mapValues(parsed, parseCondition), _.isNil), _.negate(_.isEmpty));
        const condition = _.mapValues(parsed, parseCondition);
        Logger.debug(`condition is ${r({ parsed, condition, before: _.mapValues(parsed, parseCondition) })}`);
        return condition;
      }
    } catch (reason) {
      Logger.warn(`parse where error ${r({ reason, value })}`);
    }
  }
  return null;
}

export const parseNormalWhere = (where: ParsedWhere, repository: Repository<any>): ParsedWhereConditions => {
  return parseNormalWhereAndRelatedFields(where, repository).normalWhere;
  /*
  return R.ifElse(
    _.isArray,
    (v) => _.map(v, (str) => parseNormalWhereAndRelatedFields(str, repository).normalWhere),
    (v) => [parseNormalWhereAndRelatedFields(v, repository).normalWhere],
  )(where);
*/
};
export const parseNormalWheres = (where: ParsedWheres, repository: Repository<any>): ParsedWhereConditions[] => {
  return _.map(where, (condition) => parseNormalWhereAndRelatedFields(condition, repository).normalWhere);
  /*
  return R.ifElse(
    _.isArray,
    (v) => _.map(v, (str) => parseNormalWhereAndRelatedFields(str, repository).normalWhere),
    (v) => [parseNormalWhereAndRelatedFields(v, repository).normalWhere],
  )(where);
*/
};

export function parseNormalWhereAndRelatedFields(
  where: ParsedWhere | ParsedWheres,
  repository: Repository<any>,
): {
  allRelations: string[];
  normalWhere: ParsedWhereConditions;
  relatedFields: string[];
  relatedWhere: { [key: string]: string[] };
} {
  const allRelations = repository.metadata.relations.map((relation) => relation.propertyName);
  Logger.debug(`all relations is ${r(allRelations)}`);
  const normalWhere: ParsedWhereConditions = [];
  const relatedFields = [];
  const relatedWhere = {};
  if (_.isArray(where))
    _.map(where, (condition) =>
      _.each(condition, (value, field) => {
        const [extractedModel, extractedField] = _.split(field, '.');
        const included = _.includes(allRelations, extractedModel);
        Logger.log(`check relations is ${r({ allRelations, field, extractedModel, extractedField, value, included })}`);
        if (included) {
          relatedFields.push(field);
          relatedWhere[extractedModel] = _.compact([...(relatedWhere[extractedModel] || []), extractedField]);
        } else {
          normalWhere.push({ field, value });
        }
      }),
    );
  else
    _.each(where, (value, field) => {
      const [extractedModel, extractedField] = _.split(field, '.');
      const included = _.includes(allRelations, extractedModel);
      Logger.log(`check relations is ${r({ allRelations, field, extractedModel, extractedField, value, included })}`);
      if (included) {
        relatedFields.push(field);
        relatedWhere[extractedModel] = _.compact([...(relatedWhere[extractedModel] || []), extractedField]);
      } else {
        normalWhere.push({ field, value });
      }
    });
  Logger.verbose(`parsed conditions is ${r({ normalWhere, relatedFields, relatedWhere, allRelations })}`);
  return { normalWhere, relatedFields, relatedWhere, allRelations };
}

type ParsedAndCondition = { $and: ParsedCondition[] };
type ParsedOrCondition = { $or: ParsedCondition[] };
export type ParsedCondition = FindOperator<any> | string | boolean | ParsedAndCondition | ParsedOrCondition;

function parseCondition(value: Condition): ParsedCondition | null {
  if (_.has(value, '$and')) {
    return { $and: _.map(value.$and, parseCondition) };
    // return { $and: R.map(parseCondition)(value.$and as any) as any };
  }
  if (_.has(value, '$or')) {
    return { $or: _.map(value.$or, parseCondition) };
    // return { $or: R.map(parseCondition)(value.$or as any) as any };
  }

  if (_.has(value, '$like')) return value.$like === '%%' ? null : Like(value.$like);
  if (_.has(value, '$notLike')) return Not(Like(value.$notLike));
  if (_.has(value, '$any')) return Any(value.$any);
  if (_.has(value, '$in')) return In(_.flow(_.uniq, _.compact)(_.isArray(value.$in) ? value.$in : [value.$in]));
  if (_.has(value, '$notIn')) return Not(In(value.$notIn));
  if (_.has(value, '$between')) return Between(value.$between[0], value.$between[1]);
  if (_.has(value, '$eq')) return Equal(value.$eq);
  if (_.has(value, '$lt')) return LessThan(value.$lt);
  if (_.has(value, '$gt')) return MoreThan(value.$gt);
  if (_.has(value, '$raw')) return Raw(value.$raw);
  if (_.has(value, '$notNull')) return Not(IsNull());
  if (_.has(value, '$isNull')) return IsNull();
  if (_.has(value, '$not')) return Not(value.$not);
  if (_.isBoolean(value) || _.isString(value)) return value;
  Logger.warn(`no handler found for '${r(value)}'`);
  // FIXME should throw exception
  return value as any;
}

export function parseOrder(model: string, value: string | JSON): { [name: string]: string } {
  return value
    ? _.assign(
        {},
        ..._.map(_.isString(value) ? JSON.parse(value) : value, (direction, key) => ({
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
export function parseListParam(value: string | string[], map?: (field: any) => any): string[] | any | undefined {
  if (value) {
    const list = _.isArray(value) ? (value as string[]) : (value as string).split(',').map(_.trim);
    return _.compact(_.uniq(list && map ? R.map(map, list) : list));
  }
}

export interface ParsedFields {
  fields: string[];
  relatedFieldsMap: object;
}

export function parseFields(value: string | string[], allRelations?: string[]): ParsedFields {
  const fields = parseListParam(value);
  const relatedFieldsMap = _.chain(fields)
    .filter((str) => str.includes('.'))
    .filter((str) => (allRelations ? allRelations.includes(str.split('.')[0]) : true))
    .reduce((result, val) => {
      const subModel = val.split('.')[0];
      // eslint-disable-next-line no-param-reassign
      result[subModel] = [...(result[subModel] || []), val];
      fields.splice(fields.indexOf(val), 1);
      return result;
    }, {})
    .value();
  return { fields, relatedFieldsMap };
}

export interface OriginSchema {
  info: EntityMetaInfoOptions;
  columns: ColumnSchema[];
  manyToManyRelations: ColumnSchema[];
  manyToOneRelations: ColumnSchema[];
  oneToManyRelations: ColumnSchema[];
  oneToOneRelations: ColumnSchema[];
}

export class DBHelper {
  public static metadatas: EntityMetadata[] = [];

  // private static _prismaClient: PrismaClient;
  // public static get prismaClient() {
  //   return DBHelper._prismaClient;
  // }

  /*
  public static async initPrismaClient(): Promise<void> {
    if (!DBHelper._prismaClient) {
      const dbConfig = await getConnectionOptions();
      if (!['mysql', 'postgres'].includes(dbConfig.type)) {
        Logger.warn(`not support db type '${dbConfig.type}' for prisma`);
        return;
      }

      if (dbConfig.type === 'mysql') {
        const url =
          dbConfig.url ??
          `${dbConfig.type}://${dbConfig.username}:${dbConfig.password}@${dbConfig.host ?? 'localhost'}:${
            dbConfig.port ?? 3306
          }/${dbConfig.database}`;
        Logger.log(`init db with ${url}`);
        DBHelper._prismaClient = new PrismaClient({
          datasources: { db: { url } },
          log: [{ emit: 'event', level: 'query' }],
          errorFormat: 'pretty',
        });
      } else {
        Logger.warn(`postgres prisma client init not implemented yet.`);
      }
    }
  }
*/

  public static isValidEntity(metadata): boolean {
    const isNotEntityInfo = _.isNil((metadata.target as any).entityInfo);
    const isRelation = _.includes(metadata.target as string, '__tr_');
    if (isNotEntityInfo && !isRelation) {
      Logger.warn(`Entity '${metadata.targetName}' must add @EntityMetaInfo on it.`);
      return false;
    }
    return !isRelation;
  }

  private static extractSelectableByColumn(column: ColumnMetadata, opts: { module?: string; prefix?: string }): string {
    let selectable;
    if (column.isVirtual) {
      const entityMetadata = column.referencedColumn ? column.referencedColumn.entityMetadata : column.entityMetadata;

      const { entityInfo } = entityMetadata.target as any;
      if (entityInfo) {
        selectable = entityInfo.name;
      } else {
        const { tableName } = entityMetadata;
        const name = tableName.slice(`${opts.module}${opts.prefix}`.length);
        selectable = opts.module !== 'app.graphql.graphql' ? opts.module + name : name;
      }
    }
    return selectable;
  }

  private static extractSelectableByRelation(
    relation: RelationMetadata,
    opts: { module?: string; prefix?: string },
  ): string {
    let selectable;
    if ((relation.inverseEntityMetadata.target as any).entityInfo) {
      selectable = ((relation.inverseEntityMetadata.target as any).entityInfo as EntityMetaInfoOptions).name;
    } else {
      const { tableName } = relation.inverseEntityMetadata;
      const name = tableName.slice(`${opts.module}${opts.prefix}`.length);
      selectable = opts.module !== 'app.graphql.graphql' ? opts.module + name : name;
    }
    return selectable;
  }

  public static loadMetadatas(): EntityMetadata[] {
    if (DBHelper.metadatas.length === 0) {
      AppDataSource.dataSource.entityMetadatas.forEach((metadata) => {
        if (DBHelper.isValidEntity(metadata)) {
          DBHelper.metadatas.push(metadata);
        }
      });
    }
    return DBHelper.metadatas;
  }

  public static hasRelation<R extends BaseEntity>(fullModelName: string, relation: ObjectType<R>): boolean {
    const { metadata, target } = DBHelper.repo(fullModelName);
    const relations = metadata.relations.map(fp.get('type'));
    const included = relations.find(
      (type: typeof BaseEntity & { entityInfo: EntityMetaInfoOptions }) => type.name === relation.name,
    );
    // Logger.debug(`hasRelation ${r({ included, relation: relation.name, relations })}`);
    return !_.isEmpty(included);
  }

  public static async getModelsHasRelation<E extends BaseEntity>(
    entity: ObjectType<E>,
    excludes?: (typeof BaseEntity)[],
  ): Promise<(typeof BaseEntity & { entityInfo: EntityMetaInfoOptions })[]> {
    const excludeNames = new Set(_.map(excludes, fp.get('name')));
    return DBHelper.loadMetadatas()
      .filter((metadata) => {
        const included = metadata.relations
          .map(fp.get('type'))
          .find(
            (type: typeof BaseEntity & { entityInfo: EntityMetaInfoOptions }) =>
              type.name === entity.name && !excludeNames.has(type.name),
          );
        return !_.isEmpty(included);
      })
      .map(fp.get('target') as any);
  }

  /**
   * 获取不包括 t_ 的模型名称， app__t_model -> app__model
   * 如果 module 为空，则使用默认的 module 名称
   * @param model
   * @param module 模块名称，不包括 __
   */
  public static getModelNameObject(model: string, module?: string): ModelNameObject {
    DBHelper.loadMetadatas();

    let parsedModel = model;
    const parsedModule = module || AsunaContext.instance.defaultModulePrefix;
    // 已包含 module 信息的 modelName
    if (
      model.startsWith(module) ||
      model.includes('__') ||
      !module ||
      module === AsunaContext.instance.defaultModulePrefix
    ) {
      // const metadata = DBHelper.getMetadata(model);
      // const entityInfo = DBHelper.getEntityInfo(metadata);
      // return { model, dbName: metadata.tableName, entityName: entityInfo.name };
    } else {
      parsedModel = `${module}__${model}`;
    }

    Logger.verbose(`getModelName ${r({ parsedModel, model, parsedModule, module })}`);
    const metadata = DBHelper.getMetadata(parsedModel);
    if (!metadata) {
      Logger.error(`no metadata found for ${r({ parsedModel, model, parsedModule, module })}`);
      throw new AsunaException(AsunaErrorCode.Unprocessable, `model '${parsedModel}' not resolved`);
    }
    const entityInfo = DBHelper.getEntityInfo(metadata);
    return {
      model,
      dbName: metadata.tableName,
      entityName: entityInfo.name,
      module: parsedModule,
    };
  }

  public static getMetadata(model: string): EntityMetadata {
    return DBHelper.metadatas.find((metadata) => {
      // Logger.log(`check ${(metadata.target as any).entityInfo.name} with ${model}`);
      return DBHelper.getEntityInfo(metadata).name === model;
    });
  }

  public static getEntityInfo(metadata: EntityMetadata): EntityMetaInfoOptions {
    return _.get(metadata, 'target.entityInfo');
  }

  public static getPropertyNames<Entity>(entity: ObjectType<Entity>): string[] {
    return DBHelper.getPropertyNamesByRepo(DBHelper.repo(entity));
  }

  public static filterSelect<Entity>(entity: ObjectType<Entity>, select: (keyof Entity | string)[]): (keyof Entity)[] {
    const entityPropertyNames = DBHelper.getPropertyNames(entity);
    return _.filter(select, (field: string) => entityPropertyNames.includes(field)) as any;
  }

  public static getPropertyNamesByRepo<Entity>(repo: Repository<Entity>): string[] {
    return DBHelper.getPropertyNamesByMetadata(repo.metadata);
  }

  public static getColumnByPropertyNameAndRepo<Entity>(repo: Repository<Entity>, propertyName: string): ColumnMetadata {
    return repo.metadata.columns.find((column) => column.propertyName === propertyName);
  }

  public static getPropertyNamesByMetadata<Entity>(metadata: EntityMetadata): string[] {
    return metadata.columns.map((column) => column.propertyName);
  }

  public static getRelationPropertyNames<Entity>(entity: ObjectType<Entity>): string[] {
    return DBHelper.repo(entity).metadata.relations.map((relation) => relation.propertyName);
  }

  public static getColumnNames<Entity>(entity: ObjectType<Entity>): string[] {
    return DBHelper.repo(entity).metadata.columns.map((column) => column.databaseName);
  }

  public static repo<Entity extends BaseEntity>(
    entity: ObjectType<Entity> | string | ModelNameObject,
  ): Repository<Entity> {
    DBHelper.loadMetadatas();

    if (_.isString(entity)) {
      const entityMetadata = DBHelper.getMetadata(DBHelper.getModelNameObject(entity as string).model);
      if (entityMetadata) {
        return AppDataSource.dataSource.getRepository<Entity>(entityMetadata.target);
      }
      throw new ErrorException('Repository', `no valid repository for '${entity}' founded...`);
    } else if ((entity as ModelNameObject).model) {
      return AppDataSource.dataSource.getRepository<Entity>((entity as ModelNameObject).dbName);
    } else {
      return AppDataSource.dataSource.getRepository<Entity>(entity as ObjectType<Entity>);
    }
  }

  /**
   * getPrimaryKeys
   */
  public static getPrimaryKeys(repository): string[] {
    return repository.metadata.columns.filter((column) => column.isPrimary).map((column) => column.propertyName);
  }

  public static getPrimaryKeyByModel(modelNameObject: ModelNameObject): string {
    const repository = DBHelper.repo(modelNameObject);
    return DBHelper.getPrimaryKey(repository);
  }

  public static getPrimaryKey(repository): string {
    return _.first(
      repository.metadata.columns.filter((column) => column.isPrimary).map((column) => column.propertyName),
    );
  }

  public static extractOriginAsunaSchemasByModel(modelNameObject: ModelNameObject): OriginSchema {
    const repository = DBHelper.repo(modelNameObject);
    return DBHelper.extractOriginAsunaSchemas(repository, { module: modelNameObject.module, prefix: 't' });
  }

  /**
   * @see extractOriginAsunaSchemasByModel
   */
  public static extractOriginAsunaSchemas(repository, opts: { module?: string; prefix?: string } = {}): OriginSchema {
    const { info }: { info: { [key: string]: MetaInfoOptions } } = (repository.metadata.target as Function).prototype;
    const { entityInfo } = repository.metadata.target as { entityInfo: EntityMetaInfoOptions };
    const parentEntityInfo: EntityMetaInfoOptions = repository.metadata.parentEntityMetadata?.target?.entityInfo;

    const columns = R.compose(
      // 更新可能的 STI 信息
      R.map((column: any) => {
        const currentEntityInfo = parentEntityInfo || entityInfo;
        if (currentEntityInfo.sti && currentEntityInfo.sti.name === column.name) {
          return R.mergeDeepRight(column, {
            config: {
              selectable: undefined,
              info: R.mergeDeepRight(currentEntityInfo.sti.info, {
                defaultValue: parentEntityInfo ? repository.metadata.discriminatorValue : undefined,
              }),
            },
          });
        }
        return column;
      }),
      R.map<ColumnMetadata, ColumnSchema>((column) => ({
        name: column.propertyName,
        config: {
          selectable: DBHelper.extractSelectableByColumn(column, opts),
          type: _.isString(column.type) ? column.type : (column.type as Function).name,
          primaryKey: column.isPrimary ? column.isPrimary : undefined,
          nullable: column.isNullable,
          length: column.length,
          info: info ? info[column.propertyName] : undefined,
        },
      })),
      R.filter((column: ColumnMetadata) => !R.path([column.propertyName, 'ignore'])(info)) as any,
      R.identity,
    )(repository.metadata.nonVirtualColumns);

    const manyToOneRelations = R.compose(
      R.map<RelationMetadata, ColumnSchema>((relation) => ({
        name: relation.propertyName,
        config: {
          selectable: DBHelper.extractSelectableByRelation(relation, opts),
          type: _.isString(relation.type) ? relation.type : (relation.type as Function).name,
          relation: 'ManyToOne',
          info: info ? info[relation.propertyName] : undefined,
        },
      })),
      R.filter((column: ColumnMetadata) => !R.path([column.propertyName, 'ignore'])(info)) as any,
      R.identity,
    )(repository.metadata.manyToOneRelations);

    const manyToManyRelations = R.compose(
      R.map<RelationMetadata, ColumnSchema>((relation) => ({
        name: relation.propertyName,
        config: {
          selectable: DBHelper.extractSelectableByRelation(relation, opts),
          type: _.isString(relation.type) ? relation.type : (relation.type as Function).name,
          // nullable  : relation.isNullable,
          many: true,
          relation: 'ManyToMany',
          info: info ? info[relation.propertyName] : undefined,
        },
      })),
      // R.filter(R.prop('isPrimary')),
    )(repository.metadata.manyToManyRelations);

    // 加载 OneToMany 数据
    const oneToManyRelations = R.compose(
      R.map<RelationMetadata, ColumnSchema>((relation) => ({
        name: relation.propertyName,
        config: {
          selectable: DBHelper.extractSelectableByRelation(relation, opts),
          type: _.isString(relation.type) ? relation.type : (relation.type as Function).name,
          // nullable  : relation.isNullable,
          many: true,
          relation: 'OneToMany',
          info: info ? info[relation.propertyName] : undefined,
        },
      })),
      // R.filter((relation: RelationMetadata) => info[relation.propertyName]),
    )(repository.metadata.oneToManyRelations);

    // 加载 OneToOne 数据
    const oneToOneRelations = R.compose(
      R.map<RelationMetadata, ColumnSchema>((relation) => ({
        name: relation.propertyName,
        config: {
          selectable: DBHelper.extractSelectableByRelation(relation, opts),
          type: _.isString(relation.type) ? relation.type : (relation.type as Function).name,
          relation: 'OneToOne',
          info: info ? info[relation.propertyName] : undefined,
        },
      })),
      // R.filter((column: ColumnMetadata) => !R.path([column.propertyName, 'ignore'])(info)),
    )(repository.metadata.oneToOneRelations);

    return {
      info: entityInfo,
      columns,
      manyToManyRelations,
      manyToOneRelations,
      oneToManyRelations,
      oneToOneRelations,
    };
  }

  public static extractAsunaSchemas(repository, opts: { module?: string; prefix?: string } = {}): ColumnSchema[] {
    const { columns, manyToManyRelations, manyToOneRelations, oneToManyRelations, oneToOneRelations } =
      DBHelper.extractOriginAsunaSchemas(repository, opts);

    return [
      ...columns,
      ...manyToManyRelations,
      ...manyToOneRelations,
      // 没有 info 信息的不予显示
      ...(_.filter(oneToManyRelations, fp.get('config.info')) as ColumnSchema[]),
      ...oneToOneRelations,
    ];
  }

  /**
   * profile.ids -> load all ids for relationship
   * profile.detail -> (you should not do this, it may cause memory leak)
   *                    load all details about relationship
   * @param model
   * @param queryBuilder
   * @param repository
   * @param profile
   * @param relationsStr
   * @param parsedFields
   * @param where
   */
  public static wrapProfile(
    model: string,
    queryBuilder: SelectQueryBuilder<any>,
    repository: Repository<any>,
    profile: Profile,
    relationsStr: string | string[],
    parsedFields: ParsedFields,
    where: ParsedWhere | ParsedWheres,
  ): void {
    if (profile === Profile.ids) {
      const relations = relationsStr ? parseListParam(relationsStr) : [];
      queryBuilder.loadAllRelationIds({ relations });
    } else {
      // 将 parsedFields 解析出但 relationsStr 中并未包含的关联也添加到关联列表中
      const inputRelations = _.chain(parsedFields.relatedFieldsMap)
        .keys()
        .concat(relationsStr)
        .compact()
        .uniq()
        .value()
        .join(',');
      const relations =
        profile === Profile.detail
          ? repository.metadata.relations.map((relation) => relation.propertyName)
          : parseListParam(inputRelations);

      // if (_.isArray(where)) {
      //   throw new Error('not support array where');
      // }

      // 处理条件关联
      const { relatedFields, relatedWhere, allRelations } = parseNormalWhereAndRelatedFields(where, repository);
      Logger.verbose(`wrapProfile resolve relations ${r({ where, relatedFields, relatedWhere })}`);
      relatedFields.forEach((field) => {
        const [relatedModel, relatedField] = _.split(field, '.');
        // Logger.log('[innerJoinAndSelect]', { field, model, where });
        const elementCondition = where[field] as any; // TODO type?
        Logger.log(
          `'${model}' relation with field '${field}' with value is ${r(elementCondition)} ${typeof elementCondition}`,
        );

        if (_.isObjectLike(elementCondition)) {
          let innerValue = elementCondition._value;

          if (_.isObjectLike(innerValue) && innerValue.toSql) {
            innerValue = elementCondition._value.toSql(
              AppDataSource.dataSource,
              `${relatedModel}.id`,
              elementCondition._value._value,
            );
            Logger.log(`create innerValue for '${relatedModel}.id' by ${r(elementCondition._value._value)}`);
          } else {
            innerValue = elementCondition.toSql(AppDataSource.dataSource, `${relatedModel}.${relatedField}`, [
              `'${innerValue}'`,
            ]);
            Logger.log(`create innerValue for '${relatedModel}.id' by '${innerValue}'`);
          }
          Logger.log(`innerValue is '${innerValue}'`);

          if (elementCondition._type === 'not') {
            const sqlList = innerValue.split(' ');
            sqlList.splice(1, 0, 'NOT');
            const sql = sqlList.join(' ');
            // console.log({ relatedModel, sql });

            queryBuilder.innerJoinAndSelect(`${model}.${relatedModel}`, relatedModel, sql);
          } else {
            queryBuilder.innerJoinAndSelect(`${model}.${relatedModel}`, relatedModel, innerValue);
          }
        } else {
          // console.log({ 1: `${model}.${field}`, 2: field, 3: `${field}.id = :${field}`, 4: where });
          // queryBuilder.innerJoinAndSelect(`${model}.${field}`, field, `${field}.id = :${field}`, where);
          // console.log({ 1: `${model}.${relatedModel}`, 2: relatedModel, 3: `${field} = :${field}`, 4: where });
          queryBuilder.innerJoinAndSelect(`${model}.${relatedModel}`, relatedModel, `${field} = :${field}`, where);
        }
      });

      const intersection = _.intersection(relations, allRelations);
      if (!_.isEmpty(_.difference(relations, intersection))) {
        Logger.error(
          `unresolved relation found ${r({ model, intersection, unresolved: _.difference(relations, intersection) })}`,
        );
      }
      // 处理普通关联
      const diff = _.difference(relations, _.keys(relatedWhere)).filter((relation) =>
        _.includes(allRelations, relation),
      );
      Logger.debug(`resolve normal relations ${r({ relations, extractedRelations: _.keys(relatedWhere), diff })}`);
      _.each(diff, (relation) => {
        const select = parsedFields.relatedFieldsMap[relation];
        if (select) {
          queryBuilder.leftJoin(`${model}.${relation}`, relation).addSelect(select);
        } else {
          Logger.debug(`leftJoinAndSelect ${r({ expression: `${model}.${relation}`, relation })}`);
          queryBuilder.leftJoinAndSelect(`${model}.${relation}`, relation);
        }
      });
    }
  }

  public static wrapNormalWhere(
    model: string,
    queryBuilder: SelectQueryBuilder<any>,
    wheres: ParsedWhereConditions,
  ): void {
    Logger.debug(`handle wheres ${r(wheres)}`);
    wheres.forEach((condition) => {
      Logger.debug(`handle condition ${r(condition)}`);

      if (_.has(condition.value, '$or')) {
        (condition.value as ParsedOrCondition).$or.forEach((elementCondition) => {
          const currentCondition = { field: condition.field, value: elementCondition };

          // const sqlValue = DBHelper.toSqlValue(queryBuilder, currentCondition);

          // console.log('[wheres-or]', { currentCondition, elementCondition, sqlValue });

          if (_.isObject(currentCondition)) {
            queryBuilder.orWhere({ [condition.field]: elementCondition });
            // queryBuilder.orWhere(`${model}.${sqlValue}`);
          } else {
            queryBuilder.orWhere(`${model}.${condition.field} = :${condition.field}`, {
              [condition.field]: condition.value,
            });
          }
        });
      } else if (_.has(condition.value, '$and')) {
        (condition.value as ParsedAndCondition).$and.forEach((elementCondition) => {
          const currentCondition = { field: condition.field, value: elementCondition };

          // const sqlValue = DBHelper.toSqlValue(queryBuilder, currentCondition);

          // console.log('[wheres-and]', { currentCondition, elementCondition, sqlValue });

          if (_.isObject(currentCondition)) {
            queryBuilder.andWhere({ [condition.field]: elementCondition });
            // queryBuilder.andWhere(`${model}.${sqlValue}`);
          } else {
            queryBuilder.andWhere(`${model}.${condition.field} = :${condition.field}`, {
              [condition.field]: condition.value,
            });
          }
        });
      } else {
        const elementCondition = condition.value as FindOperator<any>;

        if (elementCondition.type === 'like') {
          const primary = DBHelper.getMetadata(model).primaryColumns[0];
          const type = _.get(primary.type, 'name');
          if (type === 'Number' && process.env.TYPEORM_TYPE === 'postgres') {
            Logger.verbose(
              `fix pg int like issue ${r({
                model,
                condition,
                primary: _.omit(primary, 'entityMetadata'),
                type: type,
              })}`,
            );
            queryBuilder.andWhere(`CAST(${model}.${condition.field} AS TEXT) LIKE :searchTerm`, {
              searchTerm: elementCondition.value,
            });
            return;
          }
        }

        // const sqlValue = DBHelper.toSqlValue(queryBuilder, condition);

        Logger.verbose(`[normalWheres-default] ${r(condition)}`);

        if (_.isObject(elementCondition)) {
          queryBuilder.andWhere({ [condition.field]: elementCondition });
          // queryBuilder.andWhere(`${model}.${sqlValue}`);
        } else {
          queryBuilder.andWhere(`${model}.${condition.field} = :${condition.field}`, {
            [condition.field]: condition.value,
          });
        }
      }
    });
  }

  public static wrapParsedFields(
    model: string,
    {
      queryBuilder,
      parsedFields,
      primaryKeys,
    }: { queryBuilder: QueryBuilder<any>; parsedFields: ParsedFields; primaryKeys?: string[] },
  ): void {
    if (!_.isEmpty(parsedFields.fields)) {
      const primaryKeyColumns = primaryKeys || ['id']; // id for default
      const selection = _.uniq<string>([...parsedFields.fields, ...primaryKeyColumns]).map(
        (field) => `${model}.${field}`,
      );
      Logger.verbose(`wrapParsedFields '${r(selection)}'`);
      queryBuilder.select(selection);
    }
  }

  /*
  public static toSqlValue(
    queryBuilder: any,
    condition: { field: string; value: string | FindOperator<any> },
    suffix = '',
  ): string | { [key: string]: string | FindOperator<any> } {
    if (_.isObjectLike(condition.value)) {
      const elementCondition = condition.value as any;
      Logger.verbose(`[toSqlValue] ${r({ condition, elementCondition })}`);
      if (_.isObjectLike(elementCondition)) {
        const aliasPath = `${condition.field}${suffix}`; // condition.field;
        let innerValue = elementCondition._value;

        // console.log({ elementCondition }, elementCondition._type);

        if (elementCondition._type === 'not') {
          // console.warn('not implemented   ----->', { elementCondition });

          const innerCondition = elementCondition._value;

          const parameters = _.isArray(innerCondition._value)
            ? _.map(innerCondition._value, (v) => `'${v}'`)
            : _.flatten([innerCondition._value]);

          // console.log('[not]', { parameters });

          innerValue = innerValue.toSql(getConnection(), aliasPath, parameters);

          const temp = innerValue.split(' ');
          temp.splice(1, 0, 'not');
          temp.splice(3, 1, `'${temp[3]}'`);
          innerValue = temp.join(' ');

          // console.warn('not implemented   <-----', { innerValue });
        } else if (elementCondition._type === 'like') {
          const parameters = [`'${elementCondition._value}'`];
          // const operator = condition.value;
          // const parameters = _.isArray(elementCondition.value) ? elementCondition.value : [elementCondition.value];
          innerValue = queryBuilder.computeFindOperatorExpression(elementCondition, aliasPath, parameters);
          // innerValue = elementCondition.toSql(getConnection(), `${condition.field}${suffix}`, parameters);
          Logger.verbose(`[condition] like ${r({ elementCondition, innerValue, parameters })}`);
        } else {
          const parameters = _.isArray(elementCondition._value)
            ? _.map(elementCondition._value, (v) => `'${v}'`)
            : _.flatten([elementCondition._value]);

          // console.log('[strict]', { parameters });

          innerValue = queryBuilder.computeFindOperatorExpression(elementCondition, aliasPath, parameters);
        }
        // queryBuilder.andWhere(`${model}.${sqlValue}`);
        return innerValue;
      }
      return elementCondition;
    }
    // queryBuilder.andWhere(`${model}.${condition.field} = :${condition.field}`, sqlValue);
    return { [condition.field]: condition.value };
  }
*/

  static loadDataFilter(roles: Role[], entityName: string) {
    const dataFilters = _.merge({}, ..._.map(roles, (role) => role.dataFilter));
    Logger.log(`loaded data filter ${r({ entityName, dataFilters })}`);
    return _.get(dataFilters, entityName);
  }
}
