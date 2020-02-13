import { Module, OnModuleInit } from '@nestjs/common';
import { TracingConfig, TracingOptions } from 'jaeger-client';
import * as _ from 'lodash';
import { r } from '../common/helpers';
import { LoggerFactory } from '../common/logger';
import { configLoader } from '../config';
import { TracingHelper } from './tracing.helper';

const logger = LoggerFactory.getLogger('TracingModule');

@Module({
  imports: [],
  exports: [],
})
export class TracingModule implements OnModuleInit {
  async onModuleInit(): Promise<void> {
    const tracingConfig: TracingConfig = {};
    const tracingOptions: TracingOptions = {};
    process.env.JAEGER_DISABLED = configLoader.loadConfig('JAEGER_DISABLED', true);
    const configs = _.pickBy(configLoader.loadConfigs(), (value, key) => key.startsWith('JAEGER_'));
    logger.log(`init... ${r({ tracingConfig, tracingOptions, configs })}`);
    TracingHelper.init(tracingConfig, tracingOptions);
  }
}
