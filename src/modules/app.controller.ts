import { Controller, Get, Logger } from '@nestjs/common';

import { AppEnv } from '@danielwii/asuna-helper/dist/app.env';
import { resolveModule } from '@danielwii/asuna-helper/dist/logger/factory';
import { r } from '@danielwii/asuna-helper/dist/serializer';

import { fileURLToPath } from 'node:url';

import { named } from './helper/annotations';

@Controller()
export class AppController {
  private readonly logger = new Logger(resolveModule(fileURLToPath(import.meta.url), this.constructor.name));
  private readonly appEnv = AppEnv.instance;

  @Get()
  @named
  public info(funcName?: string) {
    this.logger.log(`#${funcName} called ${r({ funcName })}`);
    return {
      env: process.env.NODE_ENV,
      name: process.env.APP_NAME,
      description: process.env.APP_DESCRIPTION,
      version: this.appEnv.version,
    };
  }
}
