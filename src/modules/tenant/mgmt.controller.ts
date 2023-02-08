import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';

import { IsOptional, IsString } from 'class-validator';

import { JwtAdminAuthGuard } from '../core/auth/admin-auth.guard';
import { TenantInfo, TenantService } from './tenant.service';

import type { AnyAuthRequest } from '../helper/interfaces';
import type { Tenant } from './tenant.entities';

export class RegisterTenantDto {
  @IsString() name: string;
  @IsString() @IsOptional() description?: string;

  @IsOptional()
  payload?: any;
}

@Controller('admin/v1/tenant')
export class TenantAdminController {
  public constructor(private readonly tenantService: TenantService) {}

  @UseGuards(JwtAdminAuthGuard)
  @Get('info')
  async mgmtTenantInfo(@Req() req: AnyAuthRequest): Promise<TenantInfo> {
    const { user, identifier } = req;
    return this.tenantService.info(user.id);
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
    return this.tenantService.registerTenant(user.id, body, body.payload);
  }
}
