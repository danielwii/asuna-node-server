import { Controller, Get, Logger } from '@nestjs/common';

import { AppEnv } from '@danielwii/asuna-helper/dist/app.env';
import { resolveModule } from '@danielwii/asuna-helper/dist/logger/factory';

const logger = new Logger(resolveModule(__filename));

@Controller()
export class AppController {
  private readonly appEnv = AppEnv.instance;

  @Get()
  info() {
    return {
      env: process.env.NODE_ENV,
      name: process.env.APP_NAME,
      description: process.env.APP_DESCRIPTION,
      version: this.appEnv.version,
    };
  }
}
