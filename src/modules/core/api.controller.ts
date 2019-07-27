import { Controller, Get } from '@nestjs/common';
import { ApiUseTags } from '@nestjs/swagger';
import * as _ from 'lodash';
import { LoggerFactory } from '../common/logger';
import { AppContext } from './app.context';
import { KvService } from './kv';

const logger = LoggerFactory.getLogger('ApiController');

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
