import { Logger } from '@nestjs/common';
import { Args, Query, Resolver } from '@nestjs/graphql';
import * as util from 'util';

import { KvService } from './kv.service';

@Resolver()
export class KvQueryResolver {
  logger = new Logger('KvQueryResolver');

  constructor(private readonly kvService: KvService) {}

  @Query()
  async kv(@Args('collection') collection: string, @Args('key') key: string) {
    this.logger.log(`kv: ${util.inspect({ collection, key }, { colors: true })}`);
    return this.kvService.get(collection, key);
  }

  @Query()
  kvs(@Args('collection') collection: string) {
    this.logger.log(`kv: ${util.inspect({ collection }, { colors: true })}`);
    return this.kvService.find(collection);
  }
}
