import { Body, Delete, Get, Options, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiParam } from '@nestjs/swagger';
import { classToPlain } from 'class-transformer';
import * as _ from 'lodash';
import ow from 'ow';
import * as R from 'ramda';
import { BaseEntity, DeleteResult } from 'typeorm';
import { CurrentRoles, CurrentTenant, CurrentUser, JsonMap, PrimaryKey, Profile, r } from '../common';
import { LoggerFactory } from '../common/logger';
import { JwtAdminAuthGuard } from '../core/auth/admin-auth.guard';
import { Role } from '../core/auth/auth.entities';
import { JwtPayload } from '../core/auth/auth.interfaces';
import {
  ColumnSchema,
  DBHelper,
  OriginSchema,
  parseFields,
  parseNormalWhereAndRelatedFields,
  parseOrder,
  parseWhere,
} from '../core/db';
import { KvHelper } from '../core/kv';
import { RestHelper } from '../core/rest';
import { AnyAuthRequest } from '../helper/interfaces';
import { Tenant, TenantHelper } from '../tenant';
// import { AdminUser } from '../../core/auth';

const logger = LoggerFactory.getLogger('RestCrudController');

export abstract class RestCrudController {
  // TODO module or prefix may not needed in future
  protected constructor(protected module: string = '', protected prefix: string = 't') {
    // this.module = this.module ? `${this.module}__` : '';
    // this.prefix = this.prefix ? `${this.prefix}_` : '';
    logger.log(`set module: '${this.module}', prefix: '${this.prefix}'`);
  }

  /**
   * @deprecated {@see schema}
   * @param model
   */
  @ApiParam({
    name: 'model',
    description: ['about_us', 'about_us_categories', 'videos', 'video_categories'].join(','),
  })
  @UseGuards(JwtAdminAuthGuard)
  @Options(':model')
  options(@Param('model') model: string): ColumnSchema[] {
    const repository = DBHelper.repo(DBHelper.getModelNameObject(model, this.module));
    return DBHelper.extractAsunaSchemas(repository, { module: this.module, prefix: this.prefix });
  }

  @UseGuards(JwtAdminAuthGuard)
  @Get('schema/:model')
  schema(@Param('model') model: string): OriginSchema {
    const repository = DBHelper.repo(DBHelper.getModelNameObject(model, this.module));
    return DBHelper.extractOriginAsunaSchemas(repository, { module: this.module, prefix: this.prefix });
  }

  @UseGuards(JwtAdminAuthGuard)
  @Get(':model/unique')
  unique(@Param('model') model: string, @Query('column') column: string): Promise<string[]> {
    ow(column, 'column', ow.string.nonEmpty);
    const modelNameObject = DBHelper.getModelNameObject(model, this.module);
    return RestHelper.unique(modelNameObject, column);
  }

  @UseGuards(JwtAdminAuthGuard)
  @Get(':model/group-counts')
  groupCounts(
    @Param('model') model: string,
    @Query('where') whereStr: string,
    @Query('column') column: string,
  ): Promise<{ [id: string]: { [name: string]: number } }> {
    ow(column, 'column', ow.string.nonEmpty);
    const modelNameObject = DBHelper.getModelNameObject(model, this.module);
    return RestHelper.groupCounts(modelNameObject, parseWhere(whereStr), column);
  }

  @UseGuards(JwtAdminAuthGuard)
  @Get(':model')
  async list(
    @CurrentUser() admin: JwtPayload,
    @CurrentTenant() tenant: Tenant,
    @CurrentRoles() roles: Role[],
    @Param('model') model: string,
    @Query('page') page = 1,
    @Query('size') size = 10,
    @Query('profile') profile?: Profile,
    @Query('fields') fields?: string | string[],
    @Query('where') whereStr?: string,
    @Query('sort') sortStr?: string,
    @Query('relations') relationsStr?: string,
  ): Promise<{ query: object; items: any[]; total: number; page: number; size: number }> {
    const modelName = DBHelper.getModelNameObject(model, this.module);
    if (tenant) await TenantHelper.checkPermission(admin.id as string, modelName.entityName);
    const repository = DBHelper.repo(modelName);
    const parsedFields = parseFields(fields);
    const where = parseWhere(whereStr);
    const order = parseOrder(modelName.model, sortStr);
    const query = {
      where,
      order,
      parsedFields,
      skip: (page - 1) * size,
      take: +size,
    };

    // logger.log(`list ${r({ whereStr, query, order })}`);

    const queryBuilder = repository.createQueryBuilder(modelName.model);
    const primaryKeys = repository.metadata.columns
      .filter(column => column.isPrimary)
      .map(column => column.propertyName);

    // logger.log(`list ${r({ modelName, primaryKeys, parsedFields })}`);
    DBHelper.wrapParsedFields(modelName.model, { queryBuilder, parsedFields, primaryKeys });
    DBHelper.wrapProfile(modelName.model, queryBuilder, repository, profile, relationsStr, parsedFields, where);

    if (order) queryBuilder.orderBy(order as any);

    const { normalWhere } = parseNormalWhereAndRelatedFields(where, repository);
    logger.log(`list ${r(modelName)} with ${r({ where, normalWhere })}`);
    DBHelper.wrapNormalWhere(modelName.model, queryBuilder, normalWhere);

    if (await TenantHelper.tenantSupport(modelName.entityName, roles)) queryBuilder.andWhere({ tenant } as any);

    const [items, total] = await queryBuilder
      .take(query.take)
      .skip(query.skip)
      .getManyAndCount();

    logger.log(`list ${r(modelName)} ${r({ total, limit: query.take, offset: query.skip, length: items.length })}`);

    return { query, items: classToPlain(items) as any[], total, page: +page, size: +size };
  }

  @UseGuards(JwtAdminAuthGuard)
  @Get(':model/:id')
  async get(
    @Param('model') model: string,
    @Param('id') id: PrimaryKey,
    @Req() req: AnyAuthRequest,
    @Query('profile') profile?: Profile,
    @Query('fields') fields?: string,
    @Query('relations') relationsStr?: string | string[],
  ): Promise<BaseEntity> {
    return RestHelper.get(
      { model: DBHelper.getModelNameObject(model, this.module), id, profile, fields, relationsStr },
      req,
    );
  }

  @UseGuards(JwtAdminAuthGuard)
  @Delete(':model/:id')
  async delete(
    @CurrentUser() admin: JwtPayload,
    @CurrentTenant() tenant: Tenant,
    @Param('model') model: string,
    @Param('id') id: PrimaryKey,
  ): Promise<DeleteResult> {
    const modelName = DBHelper.getModelNameObject(model, this.module);
    if (tenant) await TenantHelper.checkPermission(admin.id as string, modelName.entityName);
    const repository = DBHelper.repo(modelName);
    return repository.delete(id);
  }

  @UseGuards(JwtAdminAuthGuard)
  @Post(':model')
  async save(@Param('model') model: string, @Body() updateTo: JsonMap, @Req() req: AnyAuthRequest): Promise<any> {
    return RestHelper.save({ model: DBHelper.getModelNameObject(model, this.module), body: updateTo }, req);
  }

  @UseGuards(JwtAdminAuthGuard)
  @Patch(':model/:id')
  async patch(
    @CurrentUser() admin: JwtPayload,
    @CurrentTenant() tenant: Tenant,
    @CurrentRoles() roles: Role[],
    @Param('model') model: string,
    @Param('id') id: PrimaryKey,
    @Body() updateTo: { [member: string]: any },
  ): Promise<any> {
    const modelName = DBHelper.getModelNameObject(model, this.module);
    const whereOptions = { id };
    if (tenant) {
      await TenantHelper.checkPermission(admin.id as string, modelName.entityName);
      if (await TenantHelper.tenantSupport(modelName.entityName, roles)) _.assign(whereOptions, { tenant });
    }
    logger.log(`patch ${r({ admin, modelName, id, updateTo, whereOptions })}`);
    // TODO remove kv handler from default handler
    if (modelName.model === 'kv__pairs') {
      logger.log('update by kv...');
      return KvHelper.update(id as any, updateTo.name, updateTo.type, updateTo.value);
    }

    const repository = DBHelper.repo(modelName);
    const relationKeys = _.merge(
      {},
      ...repository.metadata.relations.map(relation => ({
        [relation.propertyName]: _.get(relation, 'type.entityInfo.name'),
      })),
    );
    const relationIds = R.mapObjIndexed((value, relation) => {
      const primaryKeys = DBHelper.getPrimaryKeys(DBHelper.repo(relationKeys[relation]));
      logger.verbose(`resolve ${r({ value, relationModelName: relation, primaryKeys })}`);
      return _.isArray(value)
        ? (value as any[]).map(currentId => ({ [_.first(primaryKeys)]: currentId }))
        : { [_.first(primaryKeys)]: value };
    })(R.pick(_.keys(relationKeys))(updateTo));
    logger.log(`patch ${r({ id, relationKeys, relationIds })}`);

    const entity = await repository.findOneOrFail({ where: whereOptions });

    const entityTo = repository.merge(entity, {
      ...updateTo,
      ...relationIds,
      updatedBy: admin?.username,
    });
    logger.log(`patch ${r({ entityTo })}`);
    return repository.save(entityTo);
  }
}
