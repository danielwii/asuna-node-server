import { Controller, Get, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { LoggerFactory } from '../common/logger';
import { AppContext } from './app.context';

const logger = LoggerFactory.getLogger('ApiController');

@ApiTags('core')
@Controller('api')
export class ApiController {
  private readonly appContent = AppContext.instance;

  @Get('version')
  public currentVersion(): string {
    return `${this.appContent.version}-${this.appContent.upTime.toISOString()}`;
  }

  @Get('info')
  public info(@Req() req) {
    return {
      upTime: this.appContent.upTime.toISOString(),
      version: this.appContent.version,
    };
  }
}
