import { Logger, Module, OnModuleInit } from '@nestjs/common';

@Module({
  providers: [],
  controllers: [],
})
export class DistributeModule implements OnModuleInit {
  async onModuleInit() {
    Logger.log('init...');
  }
}
