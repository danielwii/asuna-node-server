import { Module, OnModuleInit } from '@nestjs/common';

import { InitContainer } from '@danielwii/asuna-helper/dist/init';

import { TenantModule, TenantService } from '../../tenant';
import { CoreModule } from '../core.module';
import { RestService } from './rest.service';

@Module({
  imports: [CoreModule, TenantModule],
  providers: [RestService],
  controllers: [],
  exports: [RestService],
})
export class RestModule extends InitContainer implements OnModuleInit {
  public constructor(private readonly restService: RestService, private readonly tenantService: TenantService) {
    super();
  }

  onModuleInit = async () =>
    super.init(async () => {
      this.tenantService.setSaveHandler(this.restService.save);
    });
}
