import { Module, OnModuleInit } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';

import { Hermes } from '@danielwii/asuna-helper/dist/hermes/hermes';
import { InitContainer } from '@danielwii/asuna-helper/dist/init';
import { r } from '@danielwii/asuna-helper/dist/serializer';

import { UploaderService } from './service';

@Module({
  providers: [UploaderService],
  imports: [CqrsModule],
  exports: [UploaderService],
})
export class UploaderModule extends InitContainer implements OnModuleInit {
  onModuleInit = () =>
    super.init(async () => {
      Hermes.subscribe(this.constructor.name, /^commands$/, (event) => {
        Hermes.logger.log(`event: ${r(event)}`);
      });
    });
}
