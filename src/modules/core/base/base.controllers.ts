import { Body, Delete, Get, Options, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiParam } from '@nestjs/swagger';
import { classToPlain } from 'class-transformer';
import * as _ from 'lodash';
import * as R from 'ramda';
import { DeleteResult, getManager } from 'typeorm';
import { CurrentUser, Profile, r, validateObject } from '../../common';
import { LoggerFactory } from '../../common/logger';
import { ColumnSchema, DBHelper, parseFields, parseNormalWhereAndRelatedFields, parseOrder, parseWhere } from '../db';
import { KeyValuePair, KvHelper } from '../kv';
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
  @Options(':model')
  options(@Param('model') model: string): ColumnSchema[] {
    const repository = DBHelper.repo(DBHelper.getModelName(model, this.module));
    return DBHelper.extractAsunaSchemas(repository, { module: this.module, prefix: this.prefix });
  }

  @Get('schema/:model')
  schema(
    @Param('model') model: string,
  ): {
    columns: ColumnSchema[];
    manyToManyRelations: ColumnSchema[];
    manyToOneRelations: ColumnSchema[];
    oneToManyRelations: ColumnSchema[];
    oneToOneRelations: ColumnSchema[];
  } {
    const repository = DBHelper.repo(DBHelper.getModelName(model, this.module));
    return DBHelper.extractOriginAsunaSchemas(repository, { module: this.module, prefix: this.prefix });
  }

  @Get(':model')
  async list(
    @Param('model') model: string,
    @Query('page') page = 1,
    @Query('size') size = 10,
    @Query('profile') profile?: Profile,
    @Query('fields') fields?: string | string[],
    @Query('where') whereStr?: string,
    @Query('sort') sortStr?: string,
    @Query('relations') relationsStr?: string,
  ): Promise<{ query: object; items: any[]; total: number; page: number; size: number }> {
    const modelName = DBHelper.getModelName(model, this.module);
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

    if (order) {
      queryBuilder.orderBy(order as any);
    }

    const { normalWhere } = parseNormalWhereAndRelatedFields(where, repository);
    logger.log(`list ${r({ where, normalWhere })}`);
    DBHelper.wrapNormalWhere(modelName.model, queryBuilder, normalWhere);

    const [items, total] = await queryBuilder
      .take(query.take)
      .skip(query.skip)
      .getManyAndCount();

    logger.log(`list ${r(modelName)} ${r({ total, limit: query.take, offset: query.skip, length: items.length })}`);

    return { query, items: classToPlain(items) as any[], total, page: +page, size: +size };
  }

  @Get(':model/:id')
  get(
    @Param('model') model: string,
    @Param('id') id: number,
    @Query('profile') profile?: Profile,
    @Query('fields') fields?: string,
    @Query('relations') relationsStr?: string | string[],
  ): Promise<any> {
    const modelName = DBHelper.getModelName(model, this.module);
    const repository = DBHelper.repo(modelName);
    const parsedFields = parseFields(fields);

    logger.log(`get ${r({ profile, modelName, parsedFields, relationsStr })}`);

    const queryBuilder = repository.createQueryBuilder(modelName.model);

    DBHelper.wrapParsedFields(modelName.model, { queryBuilder, parsedFields });
    DBHelper.wrapProfile(modelName.model, queryBuilder, repository, profile, relationsStr, parsedFields, null);

    queryBuilder.whereInIds(id);

    return queryBuilder.getOne();
  }

  @Delete(':model/:id')
  delete(@Param('model') model: string, @Param('id') id: number): Promise<DeleteResult> {
    const modelName = DBHelper.getModelName(model, this.module);
    const repository = DBHelper.repo(modelName);
    return repository.delete(id);
  }

  @Post(':model')
  async save(
    @CurrentUser() user, // : AdminUser,
    @Param('model') model: string,
    @Body() updateTo: { [member: string]: any },
  ): Promise<any> {
    const modelName = DBHelper.getModelName(model, this.module);
    logger.verbose(`patch ${r({ user, modelName, updateTo })}`);
    // TODO 类似 kv 这样需要代理给单独处理单元的需要增加可以注册这类处理器的功能
    if (modelName.model === 'kv__pairs') {
      const pair = KeyValuePair.create(updateTo);
      logger.log(`save by kv... ${r(pair)}`);
      return KvHelper.set(pair);
    }

    const repository = DBHelper.repo(modelName);
    const relationKeys = repository.metadata.relations.map(relation => relation.propertyName);
    const relationIds = R.map(value => (_.isArray(value) ? (value as any[]).map(id => ({ id })) : { id: value }))(
      R.pick(relationKeys, updateTo),
    );

    const entity = repository.create({
      ...updateTo,
      ...relationIds,
      updatedBy: user.username,
    });
    await validateObject(entity);
    /*
     * using getManger().save(entity) will trigger Entity Listener for entities
     * but repo.save and getManger().save(target, object) will not
     */
    const { id } = (await getManager().save(entity)) as any;
    return repository.findOneOrFail(id);
  }

  @Patch(':model/:id')
  async patch(
    @CurrentUser() admin, // : AdminUser,
    @Param('model') model: string,
    @Param('id') id: number,
    @Body() updateTo: { [member: string]: any },
  ): Promise<any> {
    const modelName = DBHelper.getModelName(model, this.module);
    logger.log(`patch ${r({ admin, modelName, id, updateTo })}`);
    // TODO remove kv handler from default handler
    if (modelName.model === 'kv__pairs') {
      logger.log('update by kv...');
      return KvHelper.update(id, updateTo.name, updateTo.type, updateTo.value);
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

    const entity = await repository.findOneOrFail(id);

    const entityTo = repository.merge(entity, {
      ...updateTo,
      ...relationIds,
      updatedBy: admin?.username,
    });
    logger.log(`patch ${r({ entityTo })}`);
    return repository.save(entityTo);
  }
}
