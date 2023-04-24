import { Global, Module, OnModuleInit } from '@nestjs/common';

import { InitContainer } from '@danielwii/asuna-helper/dist/init';

import { AppLifecycle } from '../../lifecycle';
import { PrismaService } from './service';

@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule extends InitContainer implements OnModuleInit {
  public constructor(private readonly prismaService: PrismaService) {
    super();
  }

  public onModuleInit = async (): Promise<void> =>
    super.init(() => {
      this.prismaService.enableShutdownHooks(AppLifecycle._.getApp());
    });
}
