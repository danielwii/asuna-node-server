import * as _ from 'lodash';
import * as fp from 'lodash/fp';
import * as R from 'ramda';
import { BaseEntity, FindOperator, getManager, ObjectLiteral } from 'typeorm';
import { LoggerFactory, PrimaryKey, Profile } from '../../common';
import { r, validateObject } from '../../common/helpers';
import { AnyAuthRequest, AuthInfo } from '../../helper/auth';
import { TenantHelper } from '../../tenant/tenant.helper';
import { DBHelper, ModelNameObject, parseFields } from '../db';
import { KeyValuePair, KvHelper } from '../kv';

const logger = LoggerFactory.getLogger('RestHelper');

export class RestHelper {
  static async get<T extends BaseEntity | ObjectLiteral>(
    {
      model,
      id,
      profile,
      fields,
      relationsStr,
    }: { model: ModelNameObject; id: PrimaryKey; profile?: Profile; fields?: string; relationsStr?: string | string[] },
    { user, tenant, roles }: AnyAuthRequest,
  ): Promise<T> {
    if (tenant) await TenantHelper.checkPermission(user.id as string, model.entityName);
    const repository = DBHelper.repo(model);
    const parsedFields = parseFields(fields);

    logger.log(`get ${r({ profile, model, parsedFields, relationsStr })}`);

    const queryBuilder = repository.createQueryBuilder(model.model);

    DBHelper.wrapParsedFields(model.model, { queryBuilder, parsedFields });
    DBHelper.wrapProfile(model.model, queryBuilder, repository, profile, relationsStr, parsedFields, null);

    queryBuilder.whereInIds(id);
    if (await TenantHelper.tenantSupport(model.entityName, roles)) queryBuilder.andWhere({ tenant } as any);

    return (await queryBuilder.getOne()) as any;
  }

  static async save<T extends BaseEntity | ObjectLiteral>(
    { model, body }: { model: ModelNameObject; body: T },
    { user, tenant, roles }: AuthInfo,
  ): Promise<T> {
    const tenantRelatedFields = {};
    if (tenant) {
      await TenantHelper.checkPermission(user.id as string, model.entityName);
      await TenantHelper.checkResourceLimit(user.id as string, model.entityName);
      _.assign(tenantRelatedFields, (await TenantHelper.tenantSupport(model.entityName, roles)) ? { tenant } : null);
      const config = await TenantHelper.getConfig();
      if (config.firstModelBind && config.firstModelName) {
        const originSchema = DBHelper.extractOriginAsunaSchemasByModel(model);
        // console.log('one-2-one', originSchema.oneToOneRelations);
        // console.log('many-2-one', originSchema.manyToOneRelations);
        const relationSchema = originSchema.manyToOneRelations.find(
          relation => relation.config.selectable === config.firstModelName,
        );
        const firsModel = DBHelper.getModelNameObject(config.firstModelName);
        const primaryKey = DBHelper.getPrimaryKeyByModel(firsModel);
        // 唯一标志使这里只应该拿到 0-1 个绑定实体
        const entity = await DBHelper.repo(firsModel).findOne({ where: { tenant } });
        if (relationSchema) {
          _.assign(tenantRelatedFields, { [relationSchema.name]: { [primaryKey]: entity[primaryKey] } });
        }
      }
    }
    logger.verbose(`save ${r({ user, model, body, tenant, tenantRelatedFields })}`);
    // TODO 类似 kv 这样需要代理给单独处理单元的需要增加可以注册这类处理器的功能
    if (model.model === 'kv__pairs') {
      const pair = KeyValuePair.create(body);
      logger.log(`save by kv... ${r(pair)}`);
      return (await KvHelper.set(pair)) as any;
    }

    const repository = DBHelper.repo(model);
    const relationKeys = repository.metadata.relations.map(relation => relation.propertyName);
    const relationIds = R.map(value => (_.isArray(value) ? (value as any[]).map(id => ({ id })) : { id: value }))(
      R.pick(relationKeys, body),
    );

    const entity = repository.create({
      ...body,
      ...relationIds,
      updatedBy: user.username,
      ...tenantRelatedFields,
    });
    await validateObject(entity);
    /*
     * using getManger().save(entity) will trigger Entity Listener for entities
     * but repo.save and getManger().save(target, object) will not
     */
    return getManager().save(entity as any);
  }

  static async unique(modelNameObject: ModelNameObject, column: string): Promise<string[]> {
    const repository = DBHelper.repo(modelNameObject);
    const raw = await repository
      .createQueryBuilder(modelNameObject.model)
      .select(`DISTINCT ${column}`)
      // .groupBy(column)
      .getRawMany();
    const arr = _.flatMap(raw, fp.get(column));
    logger.log(`get unique column ${column} for model ${r(modelNameObject)} is ${r(arr)}`);
    return arr;
  }

  static async groupCounts(
    modelNameObject: ModelNameObject,
    where: string[] | FindOperator<any>[] | null,
    column: string,
  ): Promise<{ [id: string]: { [name: string]: number } }> {
    const repository = DBHelper.repo(modelNameObject);
    const [[relation, value]] = _.toPairs(where);
    const field = `${relation}__id`;
    const whereSql = DBHelper.toSqlValue({ field, value });
    const raw = await repository
      .createQueryBuilder()
      .select(`${column}, ${field}, COUNT(${column}) as count`)
      .where(whereSql)
      .groupBy(`${column}, ${field}`)
      .getRawMany();

    // indexed
    // _.assign({}, ..._.map(raw, o => ({ [o[column]]: _.toNumber(o.count) })));
    const stats = _.flow(
      fp.groupBy(fp.get(field)), // group by field
      fp.mapValues(fp.map(o => ({ [o[column]]: _.toNumber(o.count) }))), // convert
      fp.mapValues(v => _.assign({}, ...v)), // merge values
      // fp.mapValues(fp.map(fp.omit(field))), // remove duplicated field in value
    )(raw);
    logger.verbose(`get group counts of column ${column} for model ${r(modelNameObject)}: ${r({ whereSql, stats })}`);
    return stats;
  }
}
