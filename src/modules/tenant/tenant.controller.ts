import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { Promise } from 'bluebird';
import { IsOptional, IsString } from 'class-validator';
import { LoggerFactory } from '../common/logger';
import { JwtAdminAuthGuard } from '../core/auth/admin-auth.guard';
import { AnyAuthRequest } from '../helper/auth';
import { Tenant } from './tenant.entities';
import { TenantHelper, TenantInfo } from './tenant.helper';
import { TenantService } from './tenant.service';

const logger = LoggerFactory.getLogger('TenantController');

class RegisterTenantDto {
  @IsString() name: string;
  @IsString() @IsOptional() description?: string;

  @IsOptional()
  payload?: any;
}

@Controller('admin/v1/tenant')
export class TenantController {
  @UseGuards(JwtAdminAuthGuard)
  @Get('info')
  async mgmtTenantInfo(@Req() req: AnyAuthRequest): Promise<TenantInfo> {
    const { user, identifier } = req;
    return TenantHelper.info(user.id);
  }

  /*
  @UseGuards(JwtAdminAuthGuard)
  @Post()
  async mgmtEnsureTenant(@Req() req: AnyAuthRequest): Promise<Tenant> {
    const { user, identifier } = req;
    return TenantHelper.ensureTenantCreated(user.id);
  }
*/

  @UseGuards(JwtAdminAuthGuard)
  @Post()
  async mgmtRegisterTenant(@Body() body: RegisterTenantDto, @Req() req: AnyAuthRequest): Promise<Tenant> {
    const { user, identifier } = req;
    return TenantService.registerTenant(user.id, body, body.payload);
  }
}
