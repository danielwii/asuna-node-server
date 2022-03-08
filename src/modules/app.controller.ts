import { Controller, Get } from '@nestjs/common';

import { AppEnv } from '@danielwii/asuna-helper/dist/app.env';

@Controller()
export class AppController {
  private readonly appEnv = AppEnv.instance;

  @Get()
  public info() {
    return {
      env: process.env.NODE_ENV,
      name: process.env.APP_NAME,
      description: process.env.APP_DESCRIPTION,
      version: this.appEnv.version,
    };
  }
}
