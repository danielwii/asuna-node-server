import { Module, OnModuleInit } from '@nestjs/common';
import { AppLifecycleType } from '../../../register';
import { LoggerFactory } from '../../common/logger';
import { KvController } from './kv.controller';
import { KvHelper } from './kv.helper';
import { KeyValueModelResolver, KvQueryResolver } from './kv.resolver';
import { LifecycleRegister } from '../../../register';

const logger = LoggerFactory.getLogger('KvModule');

@Module({
  providers: [KvQueryResolver, KeyValueModelResolver],
  controllers: [KvController],
  exports: [],
})
export class KvModule implements OnModuleInit {
  public onModuleInit(): void {
    logger.log('init...');

    LifecycleRegister.reg(
      new (class implements AppLifecycleType {
        public async appStarted(): Promise<void> {
          await KvHelper.syncMergedConstants();
        }
      })(),
    );
  }
}
