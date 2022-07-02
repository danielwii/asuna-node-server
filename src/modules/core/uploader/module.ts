import { Logger, Module, OnModuleInit } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';

import { Hermes } from '@danielwii/asuna-helper/dist/hermes/hermes';
import { r } from '@danielwii/asuna-helper/dist/serializer';

import { UploaderConfigObject } from './config';
import { UploaderService } from './service';

@Module({
  providers: [UploaderService],
  imports: [CqrsModule],
  exports: [UploaderService],
})
export class UploaderModule implements OnModuleInit {
  public onModuleInit(): void {
    Logger.log(`init ${r(UploaderConfigObject.instance)}`);
    Hermes.subscribe(this.constructor.name, /^commands$/, (event) => {
      Logger.log(r(event));
    });
  }
}
