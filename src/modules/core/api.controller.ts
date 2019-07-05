import { Controller, Get, Logger } from '@nestjs/common';
import { ApiUseTags } from '@nestjs/swagger';
import { AppContext } from './app.context';
import { KvService } from './kv';
import * as _ from 'lodash';

const logger = new Logger('ApiController');

@ApiUseTags('core')
@Controller('api')
export class ApiController {
  private readonly appContent = AppContext.instance;

  constructor(private readonly kvService: KvService) {}

  @Get('version')
  currentVersion(): string {
    return `${this.appContent.version}-${this.appContent.upTime.toISOString()}`;
  }

  @Get('info')
  async info() {
    const kv = await this.kvService.get('system.server', 'settings');
    return {
      settings: _.get(kv, 'value'),
      upTime: this.appContent.upTime.toISOString(),
      version: this.appContent.version,
    };
  }
}
