import { Logger } from '@nestjs/common';
import { Args, Query, Resolver } from '@nestjs/graphql';
import * as util from 'util';
import { KvService } from './kv.service';

@Resolver()
export class KvResolver {
  logger = new Logger('FaqQueryResolver');

  constructor(private readonly kvService: KvService) {}

  @Query()
  kv(@Args('collection') collection: string, @Args('key') key: string) {
    this.logger.log(`kv: ${util.inspect({ collection, key }, { colors: true })}`);
    return this.kvService.find(collection, key);
  }
}
