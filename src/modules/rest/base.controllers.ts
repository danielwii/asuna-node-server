import {
  Body,
  Delete,
  ForbiddenException,
  Get,
  Logger,
  Options,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UnprocessableEntityException,
  UseGuards,
} from '@nestjs/common';

import { resolveModule } from '@danielwii/asuna-helper/dist/logger/factory';
import { r } from '@danielwii/asuna-helper/dist/serializer';
import { ApiResponse } from '@danielwii/asuna-shared';

import { fileURLToPath } from 'node:url';

import { instanceToPlain } from 'class-transformer';
import _ from 'lodash';
import ow from 'ow';
import * as R from 'ramda';

import { AppLifecycle } from '../../lifecycle';
import { CurrentRoles, CurrentTenant, CurrentUser, PrimaryKey, Profile } from '../common';
import { AdminUser, AdminUserIdentifierHelper, JwtAdminAuthGuard, JwtPayload, Role } from '../core/auth';
import {
  ColumnSchema,
  DBHelper,
  OriginSchema,
  parseFields,
  parseNormalWhere,
  parseNormalWheres,
  parseOrder,
  parseWhere,
} from '../core/db';
import { KvService } from '../core/kv/kv.service';
import { RestService } from '../core/rest/rest.service';
import { AnyAuthRequest, named } from '../helper';
import { Tenant, TenantService } from '../tenant';

import type { JsonMap } from '@danielwii/asuna-shared';
import type { BaseEntity, DeleteResult } from 'typeorm';

export abstract class RestCrudController {
  private readonly superLogger = new Logger(resolveModule(fileURLToPath(import.meta.url), this.constructor.name));

  private _kvService: KvService;
  private _restService: RestService;
  private _tenantService: TenantService;
  private getKvService() {
    if (!this._kvService) {
      this._kvService = AppLifecycle._.getApp().get<KvService>(KvService);
    }
    return this._kvService;
  }
  private getRestService() {
    if (!this._restService) {
      this._restService = AppLifecycle._.getApp().get<RestService>(RestService);
    }
    return this._restService;
  }
  private getTenantService() {
    if (!this._tenantService) {
      this._tenantService = AppLifecycle._.getApp().get<TenantService>(TenantService);
    }
    return this._tenantService;
  }

  // TODO module or prefix may not needed in future
  protected constructor(protected module: string = '', protected prefix: string = 't') {
    // this.module = this.module ? `${this.module}__` : '';
    // this.prefix = this.prefix ? `${this.prefix}_` : '';
    this.superLogger.log(`set module: '${this.module}', prefix: '${this.prefix}'`);
  }

  /**
   * @deprecated {@see schema}
   * @param model
   * @param funcName
   */
  @UseGuards(JwtAdminAuthGuard)
  @Options(':model')
  @named
  public options(@Param('model') model: string, funcName?: string): ColumnSchema[] {
    this.superLogger.log(`#${funcName}: ${r({ model })}`);
    const repository = DBHelper.repo(DBHelper.getModelNameObject(model, this.module));
    return DBHelper.extractAsunaSchemas(repository, { module: this.module, prefix: this.prefix });
  }

  @UseGuards(JwtAdminAuthGuard)
  @Get('schema/:model')
  public schema(@Param('model') model: string): OriginSchema {
    const repository = DBHelper.repo(DBHelper.getModelNameObject(model, this.module));
    return DBHelper.extractOriginAsunaSchemas(repository, { module: this.module, prefix: this.prefix });
  }

  @UseGuards(JwtAdminAuthGuard)
  @Get(':model/unique')
  public unique(@Param('model') model: string, @Query('column') column: string): Promise<string[]> {
    ow(column, 'column', ow.string.nonEmpty);
    const modelNameObject = DBHelper.getModelNameObject(model, this.module);
    return this.getRestService().unique(modelNameObject, column);
  }

  @UseGuards(JwtAdminAuthGuard)
  @Get(':model/group-counts')
  public groupCounts(
    @Param('model') model: string,
    @Query('where') whereStr: string,
    @Query('column') column: string,
  ): Promise<{ [id: string]: { [name: string]: number } }> {
    ow(column, 'column', ow.string.nonEmpty);
    const modelNameObject = DBHelper.getModelNameObject(model, this.module);
    return this.getRestService().groupCounts(modelNameObject, parseWhere(whereStr), column);
  }

  /*
  @Get('query/:model')
  public query(@Param('model') model: string, @Query('action') action: string, @Query('args') args: string) {
    const modelNameObject = DBHelper.getModelNameObject(model, this.module);
    const opts = parseJSONIfCould(args);
    this.superLogger.log(`query ${r({ model, modelNameObject, action, opts, args })}`);
    return DBHelper.prismaClient[modelNameObject.dbName][action][opts];
  }
*/

  @UseGuards(JwtAdminAuthGuard)
  @Get(':model')
  @named
  public async list(
    @CurrentUser() admin: JwtPayload,
    @CurrentTenant() tenant: Tenant,
    @CurrentRoles() roles: Role[],
    @Param('model') model: string,
    @Query('page') page = 1,
    @Query('size') size = 10,
    @Query('profile') profile?: Profile,
    @Query('fields') fields?: string | string[],
    @Query('where') whereStr?: string,
    @Query('sort') sort?: string | JSON,
    @Query('relations') relationsStr?: string,
    funcName?: string,
  ): Promise<{ query: object; items: any[]; total: number; page: number; size: number }> {
    this.superLogger.log(`#${funcName}: ${r({ model, page, size, whereStr, sort, relationsStr })}`);
    const modelName = DBHelper.getModelNameObject(model, this.module);
    if (tenant) await this.getTenantService().checkPermission(admin.id as string, modelName.entityName);
    const repository = DBHelper.repo(modelName);
    const parsedFields = parseFields(fields);
    const where = parseWhere(whereStr);
    const order = parseOrder(modelName.model, sort);
    const query = { where, order, parsedFields, skip: (page - 1) * size, take: Number(size) };

    this.superLogger.log(`list ${r({ whereStr, where, query, order })}`);

    const queryBuilder = repository.createQueryBuilder(modelName.model);
    const primaryKeys = repository.metadata.columns
      .filter((column) => column.isPrimary)
      .map((column) => column.propertyName);

    // this.superLogger.log(`list ${r({ modelName, primaryKeys, parsedFields })}`);
    DBHelper.wrapParsedFields(modelName.model, { queryBuilder, parsedFields, primaryKeys });
    DBHelper.wrapProfile(modelName.model, queryBuilder, repository, profile, relationsStr, parsedFields, where);

    if (order) queryBuilder.orderBy(order as any);

    const dataFilter = DBHelper.loadDataFilter(roles, modelName.entityName);
    const filterWheres = parseWhere(JSON.stringify(dataFilter));
    // TODO 这里的 where 是数组 即 or 状态的时候简单使用 qb 来生成，DBHelper.wrapNormalWhere 用来处理更复杂的情况，但不包括最外层的 or。
    if (_.isArray(where)) {
      const parsedNormalWheres = parseNormalWheres(where, repository);
      this.superLogger.log(`list ${r(modelName)} with ${r({ where, parsedNormalWheres, filterWheres })}`);
      queryBuilder.where(where);
    } else {
      const parsedNormalWheres = parseNormalWhere(where, repository);
      this.superLogger.log(`list ${r(modelName)} with ${r({ where, parsedNormalWheres, filterWheres })}`);
      DBHelper.wrapNormalWhere(modelName.model, queryBuilder, parsedNormalWheres);
    }

    if (filterWheres) queryBuilder.andWhere(filterWheres as any);

    if (await this.getTenantService().tenantSupport(modelName.entityName, roles))
      queryBuilder.andWhere({ tenant } as any);

    const [items, total] = await queryBuilder.take(query.take).skip(query.skip).getManyAndCount();

    this.superLogger.log(
      `list ${r(modelName)} ${r({ total, limit: query.take, offset: query.skip, length: items.length })}`,
    );

    return { query, items: instanceToPlain(items) as any[], total, page: Number(page), size: Number(size) };
  }

  @UseGuards(JwtAdminAuthGuard)
  @Get(':model/:id')
  @named
  public async get(
    @Param('model') model: string,
    @Param('id') id: PrimaryKey,
    @Req() req: AnyAuthRequest,
    @Query('profile') profile?: Profile,
    @Query('fields') fields?: string,
    @Query('relations') relationsStr?: string | string[],
    funcName?: string,
  ): Promise<BaseEntity> {
    this.superLogger.log(`#${funcName}: ${r({ model, id, profile, fields, relationsStr })}`);
    return this.getRestService().get(
      { model: DBHelper.getModelNameObject(model, this.module), id, profile, fields, relationsStr },
      req,
    );
  }

  @UseGuards(JwtAdminAuthGuard)
  @Delete(':model/:id')
  public async delete(
    @CurrentUser() admin: JwtPayload,
    @CurrentTenant() tenant: Tenant,
    @Param('model') model: string,
    @Param('id') id: PrimaryKey,
  ): Promise<DeleteResult> {
    const modelName = DBHelper.getModelNameObject(model, this.module);
    if (tenant) await this.getTenantService().checkPermission(admin.id as string, modelName.entityName);
    const repository = DBHelper.repo(modelName);
    return repository.delete(id);
  }

  @UseGuards(JwtAdminAuthGuard)
  @Post(':model')
  @named
  public async save(
    @CurrentUser() current: AdminUser,
    @Param('model') model: string,
    @Body() updateTo: JsonMap,
    @Req() req: AnyAuthRequest,
    funcName?: string,
  ): Promise<any> {
    this.superLogger.log(`#${funcName}: ${r({ current, model, updateTo })}`);
    return this.getRestService().save({ model: DBHelper.getModelNameObject(model, this.module), body: updateTo }, req);
  }

  @UseGuards(JwtAdminAuthGuard)
  @Get(':model/:id/:field')
  @named
  public async viewProtectedField(
    @CurrentUser() current: AdminUser,
    // @CurrentTenant() tenant: Tenant,
    @CurrentRoles() roles: Role[],
    @Param('model') model: string,
    @Param('id') id: PrimaryKey,
    @Param('field') field: string,
    funcName?: string,
  ): Promise<ApiResponse> {
    this.superLogger.log(`#${funcName}: ${r({ current, roles, model, id, field })}`);
    // all sys admins can view the content
    if (_.map(roles, (role) => role.name).includes('SYS_ADMIN')) {
      const modelName = DBHelper.getModelNameObject(model, this.module);
      const repository = DBHelper.repo(modelName);
      const primaryKey = DBHelper.getPrimaryKey(repository);
      const record = await repository.findOne({
        select: [primaryKey, field] as any,
        where: { [primaryKey]: id },
      });
      if (!record)
        throw new UnprocessableEntityException(`The record of ${modelName.entityName} with id ${id} does not exist.`);
      this.superLogger.debug(`#${funcName}: ${r(record[field])}`);
      return ApiResponse.success({ value: record[field] });
    }
    throw new ForbiddenException();
  }

  @UseGuards(JwtAdminAuthGuard)
  @Patch(':model/:id')
  public async patch(
    @CurrentUser() current: AdminUser,
    @CurrentTenant() tenant: Tenant,
    @CurrentRoles() roles: Role[],
    @Param('model') model: string,
    @Param('id') id: PrimaryKey,
    @Body() updateTo: { [member: string]: any },
  ): Promise<any> {
    const modelName = DBHelper.getModelNameObject(model, this.module);
    const primaryKey = DBHelper.getPrimaryKeyByModel(modelName);
    // const whereOptions = { [primaryKey]: id };
    const whereOptions = {};
    if (tenant) {
      await this.getTenantService().checkPermission(current.id as string, modelName.entityName);
      if (await this.getTenantService().tenantSupport(modelName.entityName, roles)) _.assign(whereOptions, { tenant });
    }
    this.superLogger.log(`patch ${r({ current, modelName, id, updateTo, whereOptions })}`);
    // TODO remove kv handler from default handler
    if (modelName.model === 'kv__pairs') {
      this.superLogger.log('update by kv...');
      return this.getKvService().update(id as any, updateTo.name, updateTo.type, updateTo.value);
    }

    const repository = DBHelper.repo(modelName);
    // const relations = DBHelper.getRelationPropertyNames(repository.target as any);
    const relationKeys = _.merge(
      {},
      ...repository.metadata.relations.map((relation) => {
        this.superLogger.log(
          `load relation ${r({
            propertyName: relation.propertyName,
            entityInfo: _.get(relation, 'target.entityInfo'),
          })}`,
        );
        return {
          [relation.propertyName]: _.get(relation, 'target.entityInfo.name'),
        };
      }),
    );
    this.superLogger.log(`load relationIds ${r({ modelName, id, relationKeys })}`);
    const relationIds = R.mapObjIndexed((value, relation) => {
      this.superLogger.debug(`resolve ${r({ value, relation, entityName: relationKeys[relation] })}`);
      const primaryKeys = DBHelper.getPrimaryKeys(DBHelper.repo(relationKeys[relation]));
      this.superLogger.debug(`resolve ${r({ value, relationModelName: relation, primaryKeys })}`);
      return _.isArray(value)
        ? (value as any[]).map((currentId) => ({ [_.first(primaryKeys)]: currentId }))
        : { [_.first(primaryKeys)]: value };
    })(R.pick(_.keys(relationKeys))(updateTo));
    this.superLogger.log(`patch ${r({ id, relationKeys, relationIds })}`);

    const entity = await repository.findOneOrFail({ where: { id, ...whereOptions } as any });
    const identifier = AdminUserIdentifierHelper.stringify(current);
    const entityTo = repository.merge(entity, { ...updateTo, ...relationIds, updatedBy: identifier } as any);
    this.superLogger.log(`patch ${r({ entityTo })}`);
    return repository.save(entityTo);
  }
}
