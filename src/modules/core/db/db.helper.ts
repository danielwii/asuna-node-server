import * as _ from 'lodash';
import * as fp from 'lodash/fp';
import * as R from 'ramda';
import {
  Any,
  BaseEntity,
  Between,
  EntityMetadata,
  Equal,
  FindOperator,
  getConnection,
  getRepository,
  In,
  IsNull,
  LessThan,
  Like,
  MoreThan,
  Not,
  ObjectType,
  Raw,
  Repository,
} from 'typeorm';
import { ColumnMetadata } from 'typeorm/metadata/ColumnMetadata';
import { RelationMetadata } from 'typeorm/metadata/RelationMetadata';
import {
  AsunaErrorCode,
  AsunaException,
  Condition,
  EntityMetaInfoOptions,
  ErrorException,
  MetaInfoOptions,
  Profile,
  r,
} from '../../common';
import { LoggerFactory } from '../../common/logger';
import { AsunaContext } from '../context';

const logger = LoggerFactory.getLogger('DBHelper');

export interface ColumnSchema {
  name: string;
  config?: {
    type?: any; // 字段类型
    primaryKey?: boolean; // 是否是主键
    nullable?: boolean;
    many?: boolean; // 是否在数据关联中处在多的一端
    selectable?: string; // 关联的对象，用于拉取数据
    info?: MetaInfoOptions;
  };
}

export type ModelNameObject = {
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
};

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
    } catch (error) {
      logger.warn(error);
    }
  }
  return null;
}

export function parseNormalWhereAndRelatedFields(
  where,
  repository,
): { normalWhere: any[]; relatedFields: string[]; relatedWhere: { [key: string]: string[] } } {
  const allRelations = repository.metadata.relations.map(relation => relation.propertyName);
  logger.verbose(`all relations is ${r(allRelations)}`);
  const normalWhere = [];
  const relatedFields = [];
  const relatedWhere = {};
  _.each(where, (value, field) => {
    const [extractedModel, extractedField] = _.split(field, '.');
    const included = _.includes(allRelations, extractedModel);
    logger.log(`check relations is ${r({ allRelations, field, extractedModel, extractedField, value, included })}`);
    if (included) {
      relatedFields.push(field);
      relatedWhere[extractedModel] = _.compact([...(relatedWhere[extractedModel] || []), extractedField]);
    } else {
      normalWhere.push({ field, value });
    }
  });
  return { normalWhere, relatedFields, relatedWhere };
}

function parseCondition(value: Condition): string | Condition | FindOperator<any> {
  if (_.has(value, '$and')) {
    return { $and: R.map(parseCondition)(value.$and) };
  }
  if (_.has(value, '$or')) {
    return { $or: R.map(parseCondition)(value.$or) };
  }

  if (_.has(value, '$like')) return Like(value.$like);
  if (_.has(value, '$notLike')) return Not(Like(value.$notLike));
  if (_.has(value, '$any')) return Any(value.$any);
  if (_.has(value, '$in')) return In(_.isArray(value.$in) ? value.$in : [value.$in]);
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
  logger.warn(`no handler found for '${r(value)}'`);
  return value;
}

export function parseOrder(model: string, value: string): { [name: string]: string } {
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
export function parseListParam(value: string | string[], map?: (field: any) => any): string[] | any | undefined {
  if (value) {
    const list = _.isArray(value) ? (value as string[]) : (value as string).split(',').map(_.trim);
    return _.compact(_.uniq(list && map ? R.map(map, list) : list));
  }
  return undefined;
}

export type ParsedFields = {
  fields: string[];
  relatedFieldsMap: object;
};

export function parseFields(value: string | string[], allRelations?: string[]): ParsedFields {
  const fields = parseListParam(value);
  const relatedFieldsMap = _.chain(fields)
    .filter(str => str.includes('.'))
    .filter(str => (allRelations ? allRelations.includes(str.split('.')[0]) : true))
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

export type OriginSchema = {
  info: EntityMetaInfoOptions;
  columns: ColumnSchema[];
  manyToManyRelations: ColumnSchema[];
  manyToOneRelations: ColumnSchema[];
  oneToManyRelations: ColumnSchema[];
  oneToOneRelations: ColumnSchema[];
};

export class DBHelper {
  static metadatas: EntityMetadata[] = [];

  static isValidEntity(metadata): boolean {
    const isNotEntityInfo = _.isNil((metadata.target as any).entityInfo);
    const isRelation = _.includes(metadata.target as string, '__tr_');
    if (isNotEntityInfo && !isRelation) {
      logger.error(`Entity '${metadata.targetName}' must add @EntityMetaInfo on it.`);
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
    if ((relation.type as any).entityInfo) {
      selectable = ((relation.type as any).entityInfo as EntityMetaInfoOptions).name;
    } else {
      const { tableName } = relation.inverseEntityMetadata;
      const name = tableName.slice(`${opts.module}${opts.prefix}`.length);
      selectable = opts.module !== 'app.graphql.graphql' ? opts.module + name : name;
    }
    return selectable;
  }

  public static loadMetadatas(): EntityMetadata[] {
    if (this.metadatas.length === 0) {
      getConnection().entityMetadatas.forEach(metadata => {
        if (DBHelper.isValidEntity(metadata)) {
          this.metadatas.push(metadata);
        }
      });
    }
    return this.metadatas;
  }

  public static hasRelation<R extends BaseEntity>(fullModelName: string, relation: ObjectType<R>): boolean {
    const { metadata, target } = this.repo(fullModelName);
    const included = metadata.relations
      .map(fp.get('type'))
      .find((type: typeof BaseEntity & { entityInfo: EntityMetaInfoOptions }) => {
        return type.name === relation.name;
      });
    return !_.isEmpty(included);
  }

  public static getModelsHasRelation<E extends BaseEntity>(
    entity: ObjectType<E>,
    excludes?: typeof BaseEntity[],
  ): (typeof BaseEntity & { entityInfo: EntityMetaInfoOptions })[] {
    const excludeNames = _.map(excludes, fp.get('name'));
    return this.loadMetadatas()
      .filter(metadata => {
        const included = metadata.relations
          .map(fp.get('type'))
          .find(
            (type: typeof BaseEntity & { entityInfo: EntityMetaInfoOptions }) =>
              type.name === entity.name && !excludeNames.includes(type.name),
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
    this.loadMetadatas();

    let parsedModel = model;
    const parsedModule = module || AsunaContext.instance.defaultModulePrefix;
    // 已包含 module 信息的 modelName
    if (
      model.startsWith(module) ||
      model.includes('__') ||
      !module ||
      module === AsunaContext.instance.defaultModulePrefix
    ) {
      // const metadata = this.getMetadata(model);
      // const entityInfo = this.getEntityInfo(metadata);
      // return { model, dbName: metadata.tableName, entityName: entityInfo.name };
    } else {
      parsedModel = `${module}__${model}`;
    }

    logger.debug(`getModelName ${r({ parsedModel, model, parsedModule, module })}`);
    const metadata = this.getMetadata(parsedModel);
    if (!metadata) {
      throw new AsunaException(AsunaErrorCode.Unprocessable, `model '${parsedModel}' not resolved`);
    }
    const entityInfo = this.getEntityInfo(metadata);
    return {
      model,
      dbName: metadata.tableName,
      entityName: entityInfo.name,
      module: parsedModule,
    };
  }

  public static getMetadata(model: string): EntityMetadata {
    return this.metadatas.find(metadata => {
      // logger.log(`check ${(metadata.target as any).entityInfo.name} with ${model}`);
      return this.getEntityInfo(metadata).name === model;
    });
  }

  public static getEntityInfo(metadata: EntityMetadata): EntityMetaInfoOptions {
    return _.get(metadata, 'target.entityInfo');
  }

  public static getPropertyNames<Entity>(entity: ObjectType<Entity>): string[] {
    return this.repo(entity).metadata.columns.map(column => column.propertyName);
  }

  public static getRelationPropertyNames<Entity>(entity: ObjectType<Entity>): string[] {
    return this.repo(entity).metadata.relations.map(relation => relation.propertyName);
  }

  public static getColumnNames<Entity>(entity: ObjectType<Entity>): string[] {
    return this.repo(entity).metadata.columns.map(column => column.databaseName);
  }

  public static repo<Entity extends BaseEntity>(
    entity: ObjectType<Entity> | string | ModelNameObject,
  ): Repository<Entity> {
    this.loadMetadatas();

    if (_.isString(entity)) {
      const entityMetadata = this.getMetadata(this.getModelNameObject(entity as string).model);
      if (entityMetadata) {
        return getRepository<Entity>(entityMetadata.target);
      }
      throw new ErrorException('Repository', `no valid repository for '${entity}' founded...`);
    } else if ((entity as ModelNameObject).model) {
      return getRepository<Entity>((entity as ModelNameObject).dbName);
    } else {
      return getRepository<Entity>(entity as ObjectType<Entity>);
    }
  }

  /**
   * getPrimaryKeys
   */
  public static getPrimaryKeys(repository): string[] {
    return repository.metadata.columns.filter(column => column.isPrimary).map(column => column.propertyName);
  }

  public static getPrimaryKeyByModel(modelNameObject: ModelNameObject): string {
    const repository = DBHelper.repo(modelNameObject);
    return this.getPrimaryKey(repository);
  }

  public static getPrimaryKey(repository): string {
    return _.first(repository.metadata.columns.filter(column => column.isPrimary).map(column => column.propertyName));
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
    const parentEntityInfo: EntityMetaInfoOptions = repository?.metadata?.parentEntityMetadata?.target?.entityInfo;

    const columns = R.compose(
      // 更新可能的 STI 信息
      R.map(column => {
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
      R.map((column: ColumnMetadata) => ({
        name: column.propertyName,
        config: {
          selectable: DBHelper.extractSelectableByColumn(column, opts),
          type: R.is(String, column.type) ? column.type : (column.type as Function).name,
          primaryKey: column.isPrimary ? column.isPrimary : undefined,
          nullable: column.isNullable,
          length: column.length,
          info: info ? info[column.propertyName] : undefined,
        },
      })),
      R.filter((column: ColumnMetadata) => !R.path([column.propertyName, 'ignore'])(info)),
    )(repository.metadata.nonVirtualColumns);

    const manyToOneRelations = R.compose(
      R.map((relation: RelationMetadata) => ({
        name: relation.propertyName,
        config: {
          selectable: DBHelper.extractSelectableByRelation(relation, opts),
          type: R.is(String, relation.type) ? relation.type : (relation.type as Function).name,
          info: info ? info[relation.propertyName] : undefined,
        },
      })),
      R.filter((column: ColumnMetadata) => !R.path([column.propertyName, 'ignore'])(info)),
    )(repository.metadata.manyToOneRelations);

    const manyToManyRelations = R.compose(
      R.map(
        (relation: RelationMetadata): ColumnSchema => ({
          name: relation.propertyName,
          config: {
            selectable: DBHelper.extractSelectableByRelation(relation, opts),
            type: R.is(String, relation.type) ? relation.type : (relation.type as Function).name,
            // nullable  : relation.isNullable,
            many: true,
            info: info ? info[relation.propertyName] : undefined,
          },
        }),
      ),
      R.filter(R.prop('isPrimary')),
    )(repository.metadata.manyToManyRelations);

    // 加载 OneToMany 数据
    const oneToManyRelations = R.compose(
      R.map(
        (relation: RelationMetadata): ColumnSchema => ({
          name: relation.propertyName,
          config: {
            selectable: DBHelper.extractSelectableByRelation(relation, opts),
            type: R.is(String, relation.type) ? relation.type : (relation.type as Function).name,
            // nullable  : relation.isNullable,
            many: true,
            info: info ? info[relation.propertyName] : undefined,
          },
        }),
      ),
      // R.filter((relation: RelationMetadata) => info[relation.propertyName]),
    )(repository.metadata.oneToManyRelations);

    // 加载 OneToOne 数据
    const oneToOneRelations = R.compose(
      R.map((relation: RelationMetadata) => ({
        name: relation.propertyName,
        config: {
          selectable: DBHelper.extractSelectableByRelation(relation, opts),
          type: R.is(String, relation.type) ? relation.type : (relation.type as Function).name,
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
    const { columns, manyToManyRelations, manyToOneRelations, oneToManyRelations } = this.extractOriginAsunaSchemas(
      repository,
      opts,
    );

    return [
      ...columns,
      ...manyToManyRelations,
      ...manyToOneRelations,
      // 没有 info 信息的不予显示
      ...(_.filter(oneToManyRelations, fp.get('config.info')) as ColumnSchema[]),
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
    queryBuilder,
    repository,
    profile: Profile,
    relationsStr: string | string[],
    parsedFields: ParsedFields,
    where: string[] | FindOperator<any>[] | null,
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
          ? repository.metadata.relations.map(relation => relation.propertyName)
          : parseListParam(inputRelations);

      // 处理条件关联
      const { relatedFields, relatedWhere } = parseNormalWhereAndRelatedFields(where, repository);
      logger.verbose(`wrapProfile resolve relations ${r({ where, relatedFields, relatedWhere })}`);
      relatedFields.forEach(field => {
        const [relatedModel, relatedField] = _.split(field, '.');
        // logger.log('[innerJoinAndSelect]', { field, model, where });
        const elementCondition = where[field];
        logger.log(`'${model}' relation with field '${field}' with value is ${r(elementCondition)}`);

        if (_.isObjectLike(elementCondition)) {
          let innerValue = elementCondition._value;

          if (_.isObjectLike(innerValue) && innerValue.toSql) {
            innerValue = elementCondition._value.toSql(
              getConnection(),
              `${relatedModel}.id`,
              elementCondition._value._value,
            );
            logger.log(`create innerValue for '${relatedModel}.id' by ${r(elementCondition._value._value)}`);
          } else {
            // const v1 = elementCondition.toSql(getConnection(), `${relatedModel}.id`, innerValue);
            // const v2 = elementCondition.toSql(getConnection(), `${relatedModel}.id`, [innerValue]);
            // logger.log(`create innerValue for '${relatedModel}.id' by '${innerValue}' - ${r({ v1, v2 })}`);
            innerValue = elementCondition.toSql(getConnection(), `${relatedModel}.${relatedField}`, [
              `'${innerValue}'`,
            ]);
            logger.log(`create innerValue for '${relatedModel}.id' by '${innerValue}'`);
          }
          logger.log(`innerValue is '${innerValue}'`);

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

      // 处理普通关联
      const diff = _.difference(relations, _.keys(relatedWhere));
      logger.verbose(`resolve normal relations ${r({ relations, extractedRelations: _.keys(relatedWhere), diff })}`);
      _.each(diff, relation => {
        const select = parsedFields.relatedFieldsMap[relation];
        if (select) {
          queryBuilder.leftJoin(`${model}.${relation}`, relation).addSelect(select);
        } else {
          logger.verbose(`leftJoinAndSelect ${r({ expression: `${model}.${relation}`, relation })}`);
          queryBuilder.leftJoinAndSelect(`${model}.${relation}`, relation);
        }
      });
    }
  }

  public static wrapNormalWhere(model: string, queryBuilder, normalWhere): void {
    // console.log({ normalWhere });
    normalWhere.forEach(condition => {
      // console.log('condition', condition);

      if (condition.value.$or) {
        condition.value.$or.forEach(elementCondition => {
          const currentCondition = { field: condition.field, value: elementCondition };

          const sqlValue = this.toSqlValue(currentCondition);

          // console.log('[normalWhere-or]', { currentCondition, elementCondition, sqlValue });

          if (_.isObject(currentCondition)) {
            queryBuilder.orWhere(`${model}.${sqlValue}`);
          } else {
            queryBuilder.orWhere(`${model}.${condition.field} = :${condition.field}`, sqlValue);
          }
        });
      } else if (condition.value.$and) {
        condition.value.$and.forEach(elementCondition => {
          const currentCondition = { field: condition.field, value: elementCondition };

          const sqlValue = this.toSqlValue(currentCondition);

          // console.log('[normalWhere-and]', { currentCondition, elementCondition, sqlValue });

          if (_.isObject(currentCondition)) {
            queryBuilder.andWhere(`${model}.${sqlValue}`);
          } else {
            queryBuilder.andWhere(`${model}.${condition.field} = :${condition.field}`, sqlValue);
          }
        });
      } else {
        const elementCondition = condition.value;

        const sqlValue = this.toSqlValue(condition);

        // console.log('[normalWhere-default]', { condition, elementCondition, sqlValue });

        if (_.isObject(elementCondition)) {
          queryBuilder.andWhere(`${model}.${sqlValue}`);
        } else {
          queryBuilder.andWhere(`${model}.${condition.field} = :${condition.field}`, sqlValue);
        }
      }
    });
  }

  public static wrapParsedFields(
    model: string,
    { queryBuilder, parsedFields, primaryKeys }: { queryBuilder; parsedFields: ParsedFields; primaryKeys?: string[] },
  ): void {
    if (!_.isEmpty(parsedFields.fields)) {
      const primaryKeyColumns = primaryKeys || ['id']; // id for default
      const selection = _.uniq<string>([...parsedFields.fields, ...primaryKeyColumns]).map(
        field => `${model}.${field}`,
      );
      logger.debug(`wrapParsedFields '${r(selection)}'`);
      queryBuilder.select(selection);
    }
  }

  public static toSqlValue(
    condition: { field: string; value: string | FindOperator<any> },
    suffix = '',
  ): string | { [key: string]: string | FindOperator<any> } {
    if (_.isObjectLike(condition.value)) {
      const elementCondition = condition.value as any;
      if (_.isObjectLike(elementCondition) && elementCondition.toSql) {
        let innerValue = elementCondition._value;

        // console.log({ elementCondition }, elementCondition._type);

        if (elementCondition._type === 'not') {
          // console.warn('not implemented   ----->', { elementCondition });

          const innerCondition = elementCondition._value;

          const parameters = _.isArray(innerCondition._value)
            ? _.map(innerCondition._value, v => `'${v}'`)
            : _.flatten([innerCondition._value]);

          // console.log('[not]', { parameters });

          innerValue = innerValue.toSql(getConnection(), `${condition.field}${suffix}`, parameters);

          const temp = innerValue.split(' ');
          temp.splice(1, 0, 'not');
          temp.splice(3, 1, `'${temp[3]}'`);
          innerValue = temp.join(' ');

          // console.warn('not implemented   <-----', { innerValue });
        } else if (elementCondition._type === 'like') {
          const parameters = [`'${elementCondition._value}'`];

          // console.log('[strict]', { parameters });

          innerValue = elementCondition.toSql(getConnection(), `${condition.field}${suffix}`, parameters);
        } else {
          const parameters = _.isArray(elementCondition._value)
            ? _.map(elementCondition._value, v => `'${v}'`)
            : _.flatten([elementCondition._value]);

          // console.log('[strict]', { parameters });

          innerValue = elementCondition.toSql(getConnection(), `${condition.field}${suffix}`, parameters);
        }
        // queryBuilder.andWhere(`${model}.${sqlValue}`);
        return innerValue;
      }
      return elementCondition;
    }
    // queryBuilder.andWhere(`${model}.${condition.field} = :${condition.field}`, sqlValue);
    return { [condition.field]: condition.value };
  }
}
