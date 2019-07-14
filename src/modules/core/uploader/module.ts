import { Logger, Module, OnModuleInit } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { r } from '../../common/helpers';
import { Hermes } from '../bus';
import { UploaderRoot } from './model';
import { UploaderService } from './service';

const logger = new Logger('UploaderModule');

@Module({
  providers: [UploaderService],
  imports: [CqrsModule],
  exports: [UploaderService],
})
export class UploaderModule implements OnModuleInit {
  onModuleInit(): any {
    Hermes.subscribe(UploaderRoot.name, /^commands$/, event => {
      logger.log(r(event));
    });
  }
}
