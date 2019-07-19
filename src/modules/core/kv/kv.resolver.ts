import { Args, Query, Resolver } from '@nestjs/graphql';
import { r } from '../../common/helpers';
import { LoggerFactory } from '../../logger';
import { KvService } from './kv.service';

@Resolver()
export class KvQueryResolver {
  static logger = LoggerFactory.getLogger('KvQueryResolver');

  constructor(private readonly kvService: KvService) {}

  @Query()
  async kv(@Args('collection') collection: string, @Args('key') key: string) {
    KvQueryResolver.logger.log(`kv: ${r({ collection, key })}`);
    return this.kvService.get(collection, key);
  }

  @Query()
  kvs(@Args('collection') collection: string) {
    KvQueryResolver.logger.log(`kv: ${r({ collection })}`);
    return this.kvService.find(collection);
  }
}
