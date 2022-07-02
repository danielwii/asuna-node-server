import { Logger, UseGuards } from '@nestjs/common';
import { Args, Context, Query, ResolveField, Resolver, Root } from '@nestjs/graphql';

import { resolveModule } from '@danielwii/asuna-helper/dist/logger/factory';
import { r } from '@danielwii/asuna-helper/dist/serializer';

import { Promise } from 'bluebird';

import { GqlAdminAuthGuard } from '../../graphql';
import { KeyValuePair } from './kv.entities';
import { KvHelper, recognizeTypeValue } from './kv.helper';
import { KeyValueModel } from './kv.isolated.entities';

import type { GraphqlContext } from '../../dataloader/dataloader.interceptor';

@Resolver()
export class KvQueryResolver {
  private readonly logger = new Logger(resolveModule(__filename, KvQueryResolver.name));

  @Query((returns) => KeyValuePair, { nullable: true })
  public async kv(
    @Args('collection') collection: string,
    @Args('key') key: string,
    @Context() ctx,
  ): Promise<KeyValuePair> {
    this.logger.log(`kv: ${r({ collection, key })}`);
    // await KvHelper.auth(ctx, { collection });
    return KvHelper.get({ collection, key });
  }

  @Query((returns) => [KeyValuePair])
  public async kvs(@Args('collection') collection: string, @Context() ctx): Promise<KeyValuePair[]> {
    this.logger.log(`kvs: ${r({ collection })}`);
    await KvHelper.auth(ctx, { collection });
    return KvHelper.find(collection);
  }

  @UseGuards(GqlAdminAuthGuard)
  @Query((returns) => [KeyValueModel])
  public async kv_models(@Context() ctx: GraphqlContext): Promise<KeyValueModel[]> {
    return KeyValueModel.find();
  }
}

@Resolver(KeyValueModel)
export class KeyValueModelResolver {
  private logger = new Logger(resolveModule(__filename, 'KeyValueModelResolver'));

  @ResolveField((returns) => KeyValuePair)
  public async pair(@Root() model: KeyValueModel, @Context() ctx: GraphqlContext): Promise<KeyValuePair> {
    const { keyValuePairs: loader } = ctx.getDataLoaders();
    this.logger.debug(`load pair for ${model.id}`);
    return loader.load(model.pairId).then((item) => {
      [, item.value] = recognizeTypeValue(item.type, item.value);
      return item;
    });
  }
}
