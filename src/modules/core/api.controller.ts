import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import * as _ from 'lodash';
import { LoggerFactory } from '../common/logger';
import { AppContext } from './app.context';
import { KvHelper } from './kv';

const logger = LoggerFactory.getLogger('ApiController');

@ApiTags('core')
@Controller('api')
export class ApiController {
  private readonly appContent = AppContext.instance;

  @Get('version')
  currentVersion(): string {
    return `${this.appContent.version}-${this.appContent.upTime.toISOString()}`;
  }

  @Get('info')
  async info() {
    const kv = await KvHelper.get({ collection: 'system.server', key: 'settings' });
    return {
      settings: _.get(kv, 'value'),
      upTime: this.appContent.upTime.toISOString(),
      version: this.appContent.version,
    };
  }
}
