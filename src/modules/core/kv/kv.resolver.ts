import { Args, Context, Query, Resolver } from '@nestjs/graphql';
import { r } from '../../common/helpers';
import { LoggerFactory } from '../../common/logger';
import { KeyValuePair } from './kv.entities';
import { KvHelper } from './kv.helper';

@Resolver()
export class KvQueryResolver {
  logger = LoggerFactory.getLogger('KvQueryResolver');

  @Query()
  async kv(
    @Args('collection') collection: string,
    @Args('key') key: string,
    @Context() context,
  ): Promise<KeyValuePair> {
    this.logger.log(`kv: ${r({ collection, key })}`);
    await KvHelper.auth(context, { collection });
    return KvHelper.get({ collection, key });
  }

  @Query()
  async kvs(@Args('collection') collection: string, @Context() context): Promise<KeyValuePair[]> {
    this.logger.log(`kvs: ${r({ collection })}`);
    await KvHelper.auth(context, { collection });
    return KvHelper.find(collection);
  }
}
