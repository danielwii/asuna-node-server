import { Module, OnModuleInit } from '@nestjs/common';
import { r } from '../common/helpers';
import { Hermes } from '../core/bus';
import { LoggerFactory } from '../logger';

const logger = LoggerFactory.getLogger('TaskModule');

@Module({
  // providers: [UploaderService],
  // imports: [CqrsModule],
  // exports: [UploaderService],
})
export class TaskModule implements OnModuleInit {
  onModuleInit(): any {
    logger.log('init...');
    // Hermes.subscribe(TaskModule.name, /^tasks$/, event => {
    //   logger.log(r(event));
    // });
  }
}
