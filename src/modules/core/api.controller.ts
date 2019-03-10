import { Controller, Get, Logger } from '@nestjs/common';
import { AppContext } from './app.context';

const logger = new Logger('ApiController');

@Controller('api')
export class ApiController {
  private readonly appContent = AppContext.instance;

  @Get('version')
  currentVersion(): string {
    return `${this.appContent.version}-${this.appContent.upTime.getTime()}`;
  }
}
