import { Logger, Module, OnModuleInit } from '@nestjs/common';
import { KvController } from './kv.controller';
import { KvResolver } from './kv.resolver';
import { KvService } from './kv.service';

const logger = new Logger('KvModule');

@Module({
  providers: [KvService, KvResolver],
  controllers: [KvController],
})
export class KvModule implements OnModuleInit {
  public onModuleInit() {
    logger.log('init...');
  }
}
