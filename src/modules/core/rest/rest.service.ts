import { Injectable, Logger, NotFoundException } from '@nestjs/common';

import { resolveModule } from '@danielwii/asuna-helper/dist/logger/factory';
import { r } from '@danielwii/asuna-helper/dist/serializer';
import { validateObject } from '@danielwii/asuna-helper/dist/validate';

import { fileURLToPath } from 'node:url';

import _ from 'lodash';
import fp from 'lodash/fp';
import * as R from 'ramda';

import { AppDataSource } from '../../datasource';
import { TenantService } from '../../tenant/tenant.service';
import { AdminUserIdentifierHelper } from '../auth';
import { DBHelper, ModelNameObject, parseFields } from '../db';
import { KeyValuePair } from '../kv/kv.entities';
import { KvService } from '../kv/kv.service';

import type { BaseEntity, ObjectLiteral } from 'typeorm';
import type { PrimaryKey, Profile } from '../../common';
import type { AnyAuthRequest, AuthInfo } from '../../helper/interfaces';

@Injectable()
export class RestService {
  private readonly logger = new Logger(resolveModule(fileURLToPath(import.meta.url), this.constructor.name));

  public constructor(private readonly kvService: KvService, private readonly tenantService: TenantService) {}

  public async get<T extends BaseEntity>(
    {
      model,
      id,
      profile,
      fields,
      relationsStr,
    }: { model: ModelNameObject; id: PrimaryKey; profile?: Profile; fields?: string; relationsStr?: string | string[] },
    { user, tenant, roles }: AnyAuthRequest,
  ): Promise<T> {
    if (!id) throw new NotFoundException();
    if (tenant) await this.tenantService.checkPermission(user.id as string, model.entityName);
    const repository = DBHelper.repo<T>(model);
    const parsedFields = parseFields(fields);

    this.logger.log(`get ${r({ profile, model, id, parsedFields, relationsStr })}`);

    const queryBuilder = repository.createQueryBuilder(model.model);

    DBHelper.wrapParsedFields(model.model, { queryBuilder, parsedFields });
    DBHelper.wrapProfile(model.model, queryBuilder, repository, profile, relationsStr, parsedFields, null);

    queryBuilder.whereInIds(id);
    if (await this.tenantService.tenantSupport(model.entityName, roles)) queryBuilder.andWhere({ tenant } as any);

    return queryBuilder.getOne();
  }

  public async save<T extends BaseEntity | ObjectLiteral>(
    { model, body }: { model: ModelNameObject; body: T },
    { user, tenant, roles }: AuthInfo,
  ): Promise<T> {
    this.logger.log(`save ${r({ model, body })}`);
    const tenantRelatedFields = {};
    if (tenant) {
      await this.tenantService.checkPermission(user.id as string, model.entityName);
      await this.tenantService.checkResourceLimit(user.id as string, model.entityName);
      _.assign(
        tenantRelatedFields,
        (await this.tenantService.tenantSupport(model.entityName, roles)) ? { tenant } : null,
      );
      const config = await this.tenantService.getConfig();
      if (config.firstModelBind && config.firstModelName) {
        const originSchema = DBHelper.extractOriginAsunaSchemasByModel(model);
        // console.log('one-2-one', originSchema.oneToOneRelations);
        // console.log('many-2-one', originSchema.manyToOneRelations);
        const relationSchema = originSchema.manyToOneRelations.find(
          (relation) => relation.config.selectable === config.firstModelName,
        );
        const firsModel = DBHelper.getModelNameObject(config.firstModelName);
        const primaryKey = DBHelper.getPrimaryKeyByModel(firsModel);
        // 唯一标志使这里只应该拿到 0-1 个绑定实体
        const entity = await DBHelper.repo(firsModel).findOne({ where: { tenant } as any });
        if (relationSchema) {
          _.assign(tenantRelatedFields, { [relationSchema.name]: { [primaryKey]: entity[primaryKey] } });
        }
      }
    }
    this.logger.debug(`save ${r({ user, model, body, tenant, tenantRelatedFields })}`);
    // TODO 类似 kv 这样需要代理给单独处理单元的需要增加可以注册这类处理器的功能
    if (model.model === 'kv__pairs') {
      const pair = KeyValuePair.create(body);
      this.logger.log(`save by kv... ${r(pair)}`);
      return (await this.kvService.set(pair)) as any;
    }

    const repository = DBHelper.repo(model);
    const relationKeys = repository.metadata.relations.map((relation) => relation.propertyName);
    this.logger.log(`pick ${r({ relationKeys, body })}`);
    const relationIds = R.map((value) => (_.isArray(value) ? value.map((id) => ({ id })) : { id: value }))(
      R.pick(relationKeys, body || {}) as any,
    );

    const identifier = AdminUserIdentifierHelper.stringify(user);
    const entity = repository.create({
      ...body,
      ...relationIds,
      updatedBy: user.username,
      ...tenantRelatedFields,
      createdBy: identifier,
    } as any);
    await validateObject(entity);
    /*
     * using getManger().save(entity) will trigger Entity Listener for entities
     * but repo.save and getManger().save(target, object) will not
     */
    return AppDataSource.dataSource.manager.save(entity as any);
  }

  public async unique(modelNameObject: ModelNameObject, column: string): Promise<string[]> {
    const repository = DBHelper.repo(modelNameObject);
    const columnMetadata = DBHelper.getColumnByPropertyNameAndRepo(repository, column);
    const raw = await repository
      .createQueryBuilder(modelNameObject.model)
      .select(columnMetadata.databaseName)
      .distinct(true)
      .getRawMany();
    const arr = _.compact(_.flatMap(raw, fp.get(column)));
    this.logger.log(`get unique column ${column} for model ${r(modelNameObject)} is ${r(arr)}`);
    return arr;
  }

  public async groupCounts(
    modelNameObject: ModelNameObject,
    where: ObjectLiteral,
    column: string,
  ): Promise<{ [id: string]: { [name: string]: number } }> {
    const repository = DBHelper.repo(modelNameObject);
    const [[relation, value]] = _.toPairs(where);
    const field = `${relation}__id`;
    const queryBuilder = repository.createQueryBuilder();
    // const whereSql = DBHelper.toSqlValue(queryBuilder, { field, value });
    const raw = await queryBuilder
      .select(`${column}, ${field}, COUNT(${column}) as count`)
      .where({ [field]: value })
      .groupBy(`${column}, ${field}`)
      .getRawMany();

    // indexed
    // _.assign({}, ..._.map(raw, o => ({ [o[column]]: _.toNumber(o.count) })));
    const stats = _.flow(
      fp.groupBy(fp.get(field)), // group by field
      fp.mapValues(fp.map((o) => ({ [o[column]]: _.toNumber(o.count) }))), // convert
      fp.mapValues((v) => _.assign({}, ...v)), // merge values
      // fp.mapValues(fp.map(fp.omit(field))), // remove duplicated field in value
    )(raw);
    this.logger.debug(`get group counts of column ${column} for model ${r(modelNameObject)}: ${r({ stats })}`);
    return stats;
  }
}
