import { Module, OnModuleInit } from '@nestjs/common';
import { LoggerFactory } from '../common/logger';

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
