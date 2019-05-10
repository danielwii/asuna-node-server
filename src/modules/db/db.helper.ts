import { Logger } from '@nestjs/common';
import idx from 'idx';
import * as _ from 'lodash';
import * as R from 'ramda';
import { FindOperator, getConnection } from 'typeorm';
import { ColumnMetadata } from 'typeorm/metadata/ColumnMetadata';
import { RelationMetadata } from 'typeorm/metadata/RelationMetadata';
import { EntityMetaInfoOptions, MetaInfoOptions } from '../decorators';
import { ParsedFields, parseListParam, parseNormalWhereAndRelatedFields, Profile } from '../helper';

const logger = new Logger('DBHelper');

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

export class DBHelper {
  static isValidEntity(metadata): boolean {
    const isNotEntityInfo = _.isNil((metadata.target as any).entityInfo);
    const isRelation = _.includes(metadata.target as string, '__tr_');
    if (isNotEntityInfo && !isRelation) {
      logger.error(`Entity '${metadata.targetName}' must add @EntityMetaInfo on it.`);
      return false;
    }
    return !isRelation;
  }

  private static extractSelectableByColumn(
    column: ColumnMetadata,
    opts: { module?: string; prefix?: string },
  ) {
    let selectable;
    if (column.isVirtual) {
      const entityMetadata = column.referencedColumn
        ? column.referencedColumn.entityMetadata
        : column.entityMetadata;

      const entityInfo: EntityMetaInfoOptions = (entityMetadata.target as any).entityInfo;
      if (entityInfo) {
        selectable = entityInfo.name;
      } else {
        const tableName = entityMetadata.tableName;
        const name = tableName.slice(`${opts.module}${opts.prefix}`.length);
        selectable = opts.module !== 'app.graphql.graphql' ? opts.module + name : name;
      }
    }
    return selectable;
  }

  private static extractSelectableByRelation(
    relation: RelationMetadata,
    opts: { module?: string; prefix?: string },
  ) {
    let selectable;
    if ((relation.type as any).entityInfo) {
      selectable = ((relation.type as any).entityInfo as EntityMetaInfoOptions).name;
    } else {
      const tableName = relation.inverseEntityMetadata.tableName;
      const name = tableName.slice(`${opts.module}${opts.prefix}`.length);
      selectable = opts.module !== 'app.graphql.graphql' ? opts.module + name : name;
    }
    return selectable;
  }

  public static extractAsunaSchemas(repository, opts: { module?: string; prefix?: string } = {}) {
    const { info }: { info: { [key: string]: MetaInfoOptions } } = (repository.metadata
      .target as Function).prototype;
    const entityInfo: EntityMetaInfoOptions = (repository.metadata.target as any).entityInfo;
    const parentEntityInfo: EntityMetaInfoOptions = idx(
      repository,
      _ => _.metadata.parentEntityMetadata.target.entityInfo,
    ) as any;

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

    // 加载 OneToMany 数据，没有 info 信息的不予显示
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
      R.filter((relation: RelationMetadata) => info[relation.propertyName]),
    )(repository.metadata.oneToManyRelations);

    return [...columns, ...manyToManyRelations, ...manyToOneRelations, ...oneToManyRelations];
  }

  /**
   * profile.ids -> load all ids for relationship
   * profile.detail -> (you should not do this, it may cause memory leak) load all details about relationship
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
  ) {
    if (profile === Profile.ids) {
      const relations = relationsStr ? parseListParam(relationsStr) : [];
      queryBuilder.loadAllRelationIds({ relations });
    } else {
      // 将 parsedFields 解析出但 relationsStr 中并未包含的关联也添加到关联列表中
      const inputRelations = _.join(
        _.chain(parsedFields.relatedFieldsMap)
          .keys()
          .concat(relationsStr)
          .compact()
          .uniq()
          .value(),
        ',',
      );
      const relations =
        profile === Profile.detail
          ? repository.metadata.relations.map(r => r.propertyName)
          : parseListParam(inputRelations);

      // 处理条件关联
      const { relatedFields } = parseNormalWhereAndRelatedFields(where, repository);
      relatedFields.forEach(field => {
        // console.log('[innerJoinAndSelect]', { field, model, where });
        const elementCondition = where[field] as any;

        if (_.isObject(elementCondition) as any) {
          let innerValue = elementCondition._value;

          if ((_.isObject(innerValue) as any) && innerValue.toSql) {
            innerValue = elementCondition._value.toSql(
              getConnection(),
              `${field}.id`,
              elementCondition._value._value,
            );
          } else {
            innerValue = elementCondition.toSql(getConnection(), `${field}.id`, innerValue);
          }

          if (elementCondition._type === 'not') {
            const sqlList = innerValue.split(' ');
            sqlList.splice(1, 0, 'NOT');
            const sql = sqlList.join(' ');
            // console.log({ field, sql });

            queryBuilder.innerJoinAndSelect(`${model}.${field}`, field, sql);
          } else {
            queryBuilder.innerJoinAndSelect(`${model}.${field}`, field, innerValue);
          }
        } else {
          queryBuilder.innerJoinAndSelect(
            `${model}.${field}`,
            field,
            `${field}.id = :${field}`,
            where,
          );
        }
      });
      // 处理普通关联
      _.each(_.difference(relations, relatedFields), relation => {
        const select = parsedFields.relatedFieldsMap[relation];
        if (select) {
          queryBuilder.leftJoin(`${model}.${relation}`, relation).addSelect(select);
        } else {
          queryBuilder.leftJoinAndSelect(`${model}.${relation}`, relation);
        }
      });
    }
  }

  public static wrapNormalWhere(model: string, queryBuilder, normalWhere) {
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

  public static wrapParsedFields(model: string, queryBuilder, parsedFields: ParsedFields) {
    if (!_.isEmpty(parsedFields.fields)) {
      const selection = _.uniq<string>([...parsedFields.fields, 'id']).map(
        field => `${model}.${field}`,
      );
      // logger.log(`wrapParsedFields '${util.inspect(selection)}'`);
      queryBuilder.select(selection);
    }
  }

  public static toSqlValue(
    condition: { field: string; value: string | FindOperator<any> },
    suffix = '',
  ): any {
    if (_.isObject(condition.value) as any) {
      const elementCondition = condition.value as any;
      if ((_.isObject(elementCondition) as any) && elementCondition.toSql) {
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

          let temp = innerValue.split(' ');
          temp.splice(1, 0, 'not');
          temp.splice(3, 1, `'${temp[3]}'`);
          innerValue = temp.join(' ');

          // console.warn('not implemented   <-----', { innerValue });
        } else if (elementCondition._type === 'like') {
          const parameters = [`'${elementCondition._value}'`];

          // console.log('[strict]', { parameters });

          innerValue = elementCondition.toSql(
            getConnection(),
            `${condition.field}${suffix}`,
            parameters,
          );
        } else {
          const parameters = _.isArray(elementCondition._value)
            ? _.map(elementCondition._value, v => `'${v}'`)
            : _.flatten([elementCondition._value]);

          // console.log('[strict]', { parameters });

          innerValue = elementCondition.toSql(
            getConnection(),
            `${condition.field}${suffix}`,
            parameters,
          );
        }
        // queryBuilder.andWhere(`${model}.${sqlValue}`);
        return innerValue;
      }
      return elementCondition;
    } else {
      // queryBuilder.andWhere(`${model}.${condition.field} = :${condition.field}`, sqlValue);
      return { [condition.field]: condition.value };
    }
  }
}
