import { Logger, Module, OnModuleInit } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';

import { Hermes } from '@danielwii/asuna-helper/dist/hermes/hermes';
import { r } from '@danielwii/asuna-helper/dist/serializer';

import { resolveModule } from '@danielwii/asuna-helper/dist/logger/factory';
import { UploaderConfigObject } from './config';
import { UploaderService } from './service';

const logger = new Logger(resolveModule(__filename, 'UploaderModule'));

@Module({
  providers: [UploaderService],
  imports: [CqrsModule],
  exports: [UploaderService],
})
export class UploaderModule implements OnModuleInit {
  public onModuleInit(): void {
    logger.log(`init ${r(UploaderConfigObject.instance)}`);
    Hermes.subscribe(this.constructor.name, /^commands$/, (event) => {
      logger.log(r(event));
    });
  }
}
