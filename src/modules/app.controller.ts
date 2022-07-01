import opentelemetry from '@opentelemetry/api';

import { Controller, Get, Logger, Req, Res } from '@nestjs/common';

import { AppEnv } from '@danielwii/asuna-helper/dist/app.env';
import { resolveModule } from '@danielwii/asuna-helper/dist/logger/factory';

import type { Request, Response } from 'express';

const logger = new Logger(resolveModule(__filename));

@Controller()
export class AppController {
  private readonly appEnv = AppEnv.instance;

  @Get()
  info(@Req() req: Request, @Res() res: Response) {
    /*
    const provider = opentelemetry.trace.getTracerProvider();
    logger.log(`provider is ${r(provider)}`); */
    const tracer = opentelemetry.trace.getTracer('default');
    /*
    logger.log(`tracer is ${r(tracer)}`);
    const context = opentelemetry.context.active();
    logger.log(`context is ${r(context)}`);
    const span = opentelemetry.trace.getSpan(context);
    logger.log(`span is ${r(span)}`); */
    const span = tracer.startSpan('info');
    span.addEvent('Info API Called', { randomIndex: 1 });
    res.send({
      env: process.env.NODE_ENV,
      name: process.env.APP_NAME,
      description: process.env.APP_DESCRIPTION,
      version: this.appEnv.version,
    });
    span.end();
  }
}
