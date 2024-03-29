import { Controller, Get } from '@nestjs/common';

import { AppEnv } from '@danielwii/asuna-helper/dist/app.env';

@Controller('api/v1/debug')
export class DebugController {
  @Get('configs')
  public configs() {
    return AppEnv.configLoader.loadConfigs();
  }

  @Get('debug-sentry')
  public debugSentry() {
    throw new Error('My first Sentry error!');
  }
}
