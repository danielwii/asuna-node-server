import * as jaeger from 'jaeger-client';
import { JaegerTracer, TracingConfig, TracingOptions } from 'jaeger-client';
import * as _ from 'lodash';
import SpanContext from 'opentracing/lib/span_context';
import { r } from '../common/helpers';
import { LoggerFactory } from '../common/logger';
import { configLoader } from '../config';

const logger = LoggerFactory.getLogger('TracingHelper');

export interface WithSpanContext {
  trace: SpanContext;
}

export class TracingHelper {
  public static tracer: JaegerTracer;

  static init(tracingConfig?: TracingConfig, tracingOptions?: TracingOptions): JaegerTracer {
    if (this.tracer) return this.tracer;

    process.env.JAEGER_DISABLED = `${!configLoader.loadBoolConfig('JAEGER_ENABLED', false)}`;
    process.env.JAEGER_SAMPLER_TYPE = 'const';
    process.env.JAEGER_SAMPLER_PARAM = '1';
    const configs = _.pickBy(configLoader.loadConfigs(), (value, key) => key.startsWith('JAEGER_'));
    logger.log(
      `init... ${r({ tracingConfig, tracingOptions, configs, JAEGER_DISABLED: process.env.JAEGER_DISABLED })}`,
    );
    this.tracer = jaeger.initTracerFromEnv(tracingConfig, tracingOptions);
    return this.tracer;
  }
}
