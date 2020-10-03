import { Module, OnModuleInit } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { r } from '../../common/helpers';
import { LoggerFactory } from '../../common/logger';
import { Hermes } from '../bus';
import { UploaderService } from './service';
import { UploaderConfigObject } from './config';

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
