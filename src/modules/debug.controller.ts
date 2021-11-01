import { Controller, Get } from '@nestjs/common';

import { AppEnv } from '@danielwii/asuna-helper/dist/app.env';

@Controller('api/v1/debug')
export class DebugController {
  @Get('configs')
  public static configs() {
    return AppEnv.configLoader.loadConfigs();
  }
}
