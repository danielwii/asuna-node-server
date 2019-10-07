import { Args, Query, Resolver } from '@nestjs/graphql';
import { r } from '../../common/helpers';
import { LoggerFactory } from '../../common/logger';
import { KvHelper } from './kv.helper';

@Resolver()
export class KvQueryResolver {
  static logger = LoggerFactory.getLogger('KvQueryResolver');

  @Query()
  async kv(@Args('collection') collection: string, @Args('key') key: string) {
    KvQueryResolver.logger.log(`kv: ${r({ collection, key })}`);
    return KvHelper.get(collection, key);
  }

  @Query()
  kvs(@Args('collection') collection: string) {
    KvQueryResolver.logger.log(`kv: ${r({ collection })}`);
    return KvHelper.find(collection);
  }
}
