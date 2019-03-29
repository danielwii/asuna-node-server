import {
  Body,
  Delete,
  Get,
  Inject,
  Logger,
  Options,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';

import { ApiImplicitParam } from '@nestjs/swagger';
import idx from 'idx';
import * as _ from 'lodash';
import * as R from 'ramda';

import { getManager } from 'typeorm';
import * as util from 'util';
import { AdminUser } from '../core/auth/auth.entities';
import { CurrentUser } from '../decorators/user.decorator';

import {
  parseFields,
  parseNormalWhereAndRelatedFields,
  parseOrder,
  parseWhere,
  Profile,
} from '../helper';
import { validateObject } from '../helpers/validate.helper';
import { KvService } from '../kv';
import { DBHelper } from './db.helper';
import { DBService } from './db.service';

const logger = new Logger('RestCrudController');

export abstract class RestCrudController {
  @Inject('KvService')
  private readonly kvService: KvService;
  @Inject('DBService')
  private readonly dbService: DBService;

  // TODO module or prefix may not needed in future
  protected constructor(protected module: string = '', protected prefix: string = 't') {
    this.module = this.module ? `${this.module}__` : '';
    this.prefix = this.prefix ? `${this.prefix}_` : '';
    logger.log(`set module: '${this.module}', prefix: '${this.prefix}'`);
  }

  getModelName(model: string) {
    if (model.startsWith(this.module) || this.module.includes('__')) {
      return model;
    }
    return `${this.module}${model}`;
  }

  @ApiImplicitParam({
    name: 'model',
    description: ['about_us', 'about_us_categories', 'videos', 'video_categories'].join(','),
  })
  @Options(':model')
  options(@Param('model') model: string) {
    const modelName = this.getModelName(model);
    const repository = this.dbService.repo(modelName);
    return DBHelper.extractAsunaSchemas(repository, { module: this.module, prefix: this.prefix });
  }

  @Get(':model')
  async list(
    @Param('model') model: string,
    @Query('page') page: number = 1,
    @Query('size') size: number = 10,
    @Query('profile') profile?: Profile,
    @Query('fields') fields?: string | string[],
    @Query('where') whereStr?: string,
    @Query('sort') sortStr?: string,
    @Query('relations') relationsStr?: string,
  ) {
    const modelName = this.getModelName(model);
    const repository = this.dbService.repo(modelName);
    const parsedFields = parseFields(fields);
    const where = parseWhere(whereStr);
    const order = parseOrder(modelName, sortStr);
    const query = {
      where,
      order,
      parsedFields,
      skip: (page - 1) * size,
      take: +size,
    };

    // console.log('list', { query, order });

    const queryBuilder = repository.createQueryBuilder(modelName);

    DBHelper.wrapParsedFields(modelName, queryBuilder, parsedFields);
    DBHelper.wrapProfile(
      modelName,
      queryBuilder,
      repository,
      profile,
      relationsStr,
      parsedFields,
      where,
    );

    if (order) {
      queryBuilder.orderBy(order as any);
    }

    const { normalWhere } = parseNormalWhereAndRelatedFields(where, repository);
    DBHelper.wrapNormalWhere(modelName, queryBuilder, normalWhere);

    const total = await queryBuilder.getCount();
    const items = await queryBuilder
      .take(query.take)
      .skip(query.skip)
      .getMany();

    // console.log(total, { limit: query.take, offset: query.skip }, items.length);

    return { query, items, total, page: +page, size: +size };
  }

  @Get(':model/:id')
  get(
    @Param('model') model: string,
    @Param('id') id: number,
    @Query('profile') profile?: Profile,
    @Query('fields') fields?: string,
    @Query('relations') relationsStr?: string | string[],
  ) {
    const modelName = this.getModelName(model);
    const repository = this.dbService.repo(modelName);
    const parsedFields = parseFields(fields);

    logger.log(
      `get ${util.inspect({ profile, modelName, parsedFields, relationsStr }, { colors: true })}`,
    );

    const queryBuilder = repository.createQueryBuilder(modelName);

    DBHelper.wrapParsedFields(modelName, queryBuilder, parsedFields);
    DBHelper.wrapProfile(
      modelName,
      queryBuilder,
      repository,
      profile,
      relationsStr,
      parsedFields,
      null,
    );

    queryBuilder.whereInIds(id);

    return queryBuilder.getOne();
  }

  @Delete(':model/:id')
  delete(@Param('model') model: string, @Param('id') id: number) {
    const modelName = this.getModelName(model);
    const repository = this.dbService.repo(modelName);
    return repository.delete(id);
  }

  @Post(':model')
  async save(
    @CurrentUser() user: AdminUser,
    @Param('model') model: string,
    @Body() updateTo: { [member: string]: any },
  ) {
    const modelName = this.getModelName(model);
    logger.log(`patch ${util.inspect({ user, modelName, updateTo }, { colors: true })}`);
    if (modelName === 'kv__pairs') {
      logger.log('save by kvService...');
      return this.kvService.set(
        updateTo.collection,
        updateTo.key,
        updateTo.name,
        updateTo.type,
        updateTo.value,
      );
    }

    const repository = this.dbService.repo(modelName);
    const relationKeys = repository.metadata.relations.map(r => r.propertyName);
    const relationIds = R.map(value =>
      _.isArray(value) ? (value as any[]).map(id => ({ id })) : { id: value },
    )(R.pick(relationKeys, updateTo));

    const entity = repository.create({
      ...updateTo,
      ...relationIds,
      updatedBy: idx(user, _ => _.username),
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
    @CurrentUser() user: AdminUser,
    @Param('model') model: string,
    @Param('id') id: number,
    @Body() updateTo: { [member: string]: any },
  ) {
    const modelName = this.getModelName(model);
    logger.log(`patch ${util.inspect({ user, modelName, id, updateTo }, { colors: true })}`);
    if (modelName === 'kv__pairs') {
      logger.log('update by kvService...');
      return this.kvService.update(id, updateTo.name, updateTo.type, updateTo.value);
    }

    const repository = this.dbService.repo(modelName);
    const relationKeys = repository.metadata.relations.map(r => r.propertyName);
    const relationIds = R.map(value =>
      _.isArray(value) ? (value as any[]).map(id => ({ id })) : { id: value },
    )(R.pick(relationKeys)(updateTo));

    const entity = await repository.findOneOrFail(id);

    const entityTo = repository.merge(entity, {
      ...updateTo,
      ...relationIds,
      updatedBy: idx(user, _ => _.username),
    });
    return repository.save(entityTo);
  }
}
