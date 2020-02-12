import * as jaeger from 'jaeger-client';
import { JaegerTracer, TracingConfig, TracingOptions } from 'jaeger-client';
import SpanContext from 'opentracing/lib/span_context';

export interface WithSpanContext {
  trace: SpanContext;
}

export class TracingHelper {
  public static tracer: JaegerTracer;

  static init(tracingConfig: TracingConfig, tracingOptions: TracingOptions) {
    this.tracer = jaeger.initTracerFromEnv(tracingConfig, tracingOptions);
  }
}
