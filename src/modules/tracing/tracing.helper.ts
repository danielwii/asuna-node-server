import { Logger } from '@nestjs/common';

import { r } from '@danielwii/asuna-helper/dist/serializer';

import jaegerClient, { JaegerTracer, TracingConfig, TracingOptions } from 'jaeger-client';

import { TracingConfigObject } from './tracing.config';

import type SpanContext from 'opentracing/lib/span_context';

const { initTracer } = jaegerClient;

export interface WithSpanContext {
  trace: SpanContext;
}

export class TracingHelper {
  public static tracer: JaegerTracer;

  public static init(tracingConfig?: TracingConfig, tracingOptions?: TracingOptions): JaegerTracer {
    if (this.tracer) return this.tracer;

    const config = TracingConfigObject.load();

    Logger.log(`init... ${r({ tracingConfig, tracingOptions, config, JAEGER_DISABLED: process.env.JAEGER_DISABLED })}`);
    this.tracer = initTracer(
      {
        disable: !config.enabled,
        ...tracingConfig,
        sampler: { type: 'const', param: 1 },
        serviceName: config.serviceName,
        reporter: { collectorEndpoint: config.endpoint },
      },
      tracingOptions,
    );
    return this.tracer;
  }
}
