import * as jaeger from 'jaeger-client';
import { JaegerTracer, TracingConfig, TracingOptions } from 'jaeger-client';
import SpanContext from 'opentracing/lib/span_context';
import { r } from '../common/helpers';
import { LoggerFactory } from '../common/logger';
import { TracingConfigObject } from './tracing.config';

const logger = LoggerFactory.getLogger('TracingHelper');

export interface WithSpanContext {
  trace: SpanContext;
}

export class TracingHelper {
  public static tracer: JaegerTracer;

  static init(tracingConfig?: TracingConfig, tracingOptions?: TracingOptions): JaegerTracer {
    if (this.tracer) return this.tracer;

    const config = TracingConfigObject.load();

    process.env.JAEGER_DISABLED = `${!config.enabled}`;
    process.env.JAEGER_SAMPLER_TYPE = 'const';
    process.env.JAEGER_SAMPLER_PARAM = '1';
    logger.log(`init... ${r({ tracingConfig, tracingOptions, config, JAEGER_DISABLED: process.env.JAEGER_DISABLED })}`);
    this.tracer = jaeger.initTracerFromEnv(tracingConfig, tracingOptions);
    return this.tracer;
  }
}
