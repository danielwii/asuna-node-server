import { Module, OnModuleInit } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';

import { LoggerFactory } from '@danielwii/asuna-helper/dist/logger';
import { r } from '@danielwii/asuna-helper/dist/serializer';

import { Hermes } from '../bus';
import { UploaderConfigObject } from './config';
import { UploaderService } from './service';

const logger = LoggerFactory.getLogger('UploaderModule');

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
