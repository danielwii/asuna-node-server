import { Module, OnModuleInit } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { r } from '../../common/helpers';
import { LoggerFactory } from '../../common/logger';
import { Hermes } from '../bus';
import { UploaderRoot } from './model';
import { UploaderService } from './service';

const logger = LoggerFactory.getLogger('UploaderModule');

@Module({
  providers: [UploaderService],
  imports: [CqrsModule],
  exports: [UploaderService],
})
export class UploaderModule implements OnModuleInit {
  onModuleInit(): void {
    Hermes.subscribe(UploaderRoot.name, /^commands$/, event => {
      logger.log(r(event));
    });
  }
}
