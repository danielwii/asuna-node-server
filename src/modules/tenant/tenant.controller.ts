import { Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { Promise } from 'bluebird';
import { LoggerFactory } from '../common/logger';
import { AnyAuthRequest, JwtAdminAuthGuard } from '../core/auth';
import { Tenant } from './tenant.entities';
import { TenantHelper } from './tenant.helper';

const logger = LoggerFactory.getLogger('TenantController');

@Controller('admin/v1/tenant')
export class TenantController {
  @UseGuards(JwtAdminAuthGuard)
  @Get('info')
  async mgmtTenantInfo(@Req() req: AnyAuthRequest): Promise<any> {
    const { user, identifier } = req;
    return TenantHelper.info(user.id);
  }

  @UseGuards(JwtAdminAuthGuard)
  @Post()
  async mgmtEnsureTenant(@Req() req: AnyAuthRequest): Promise<Tenant> {
    const { user, identifier } = req;
    return TenantHelper.ensureTenantCreated(user.id);
  }
}
