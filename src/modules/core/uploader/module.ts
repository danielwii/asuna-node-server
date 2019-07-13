import { Logger, Module, OnModuleInit } from '@nestjs/common';
import { r } from '../../common/helpers';
import { Hermes } from '../bus';
import { UploaderRoot } from './model';

const logger = new Logger('UploaderModule');

@Module({})
export class UploaderModule implements OnModuleInit {
  onModuleInit(): any {
    Hermes.subscribe(UploaderRoot.name, /^commands$/, event => {
      logger.log(r(event));
    });
  }
}
