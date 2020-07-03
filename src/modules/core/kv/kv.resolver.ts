import { UseGuards } from '@nestjs/common';
import { Args, Context, Query, ResolveField, Resolver, Root } from '@nestjs/graphql';
import { Promise } from 'bluebird';
import { r } from '../../common/helpers';
import { LoggerFactory } from '../../common/logger';
import { GraphqlContext } from '../../dataloader';
import { GqlAdminAuthGuard, GraphqlHelper } from '../../graphql';
import { KeyValueModel, KeyValuePair } from './kv.entities';
import { KvHelper, recognizeTypeValue } from './kv.helper';

@Resolver()
export class KvQueryResolver {
  logger = LoggerFactory.getLogger(this.constructor.name);

  @Query()
  async kv(@Args('collection') collection: string, @Args('key') key: string, @Context() ctx): Promise<KeyValuePair> {
    this.logger.log(`kv: ${r({ collection, key })}`);
    await KvHelper.auth(ctx, { collection });
    return KvHelper.get({ collection, key });
  }

  @Query()
  async kvs(@Args('collection') collection: string, @Context() ctx): Promise<KeyValuePair[]> {
    this.logger.log(`kvs: ${r({ collection })}`);
    await KvHelper.auth(ctx, { collection });
    return KvHelper.find(collection);
  }

  @UseGuards(GqlAdminAuthGuard)
  @Query()
  async kv_models(@Context() ctx: GraphqlContext): Promise<KeyValueModel[]> {
    return KeyValueModel.find();
  }
}

@Resolver(KeyValueModel)
export class KeyValueModelResolver {
  logger = LoggerFactory.getLogger(this.constructor.name);

  @ResolveField()
  async pair(@Root() model: KeyValueModel, @Context() ctx: GraphqlContext): Promise<KeyValuePair> {
    this.logger.debug(`load pair for ${model.id}`);
    return GraphqlHelper.resolveProperty<KeyValueModel, KeyValuePair>({
      cls: KeyValueModel,
      instance: model,
      key: 'pair',
      targetCls: KeyValuePair,
      loader: ctx.getDataLoaders().keyValuePairs,
    }).then((item) => {
      // eslint-disable-next-line no-param-reassign
      [, item.value] = recognizeTypeValue(item.type, item.value);
      return item;
    });
  }
}
