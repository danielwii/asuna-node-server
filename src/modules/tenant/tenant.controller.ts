import { Controller, Get, Logger, Req, UseGuards } from '@nestjs/common';

import { resolveModule } from '@danielwii/asuna-helper/dist/logger/factory';
import { r } from '@danielwii/asuna-helper/dist/serializer';

import { fileURLToPath } from 'node:url';

import { JwtAuthGuard } from '../core/auth/auth.guard';
import { TenantInfo, TenantService } from './tenant.service';

import type { AnyAuthRequest } from '../helper/interfaces';

@Controller('api/v1/tenant')
export class TenantController {
  private readonly logger = new Logger(resolveModule(fileURLToPath(import.meta.url), this.constructor.name));

  public constructor(private readonly tenantService: TenantService) {}

  @UseGuards(JwtAuthGuard)
  @Get('info')
  async info(@Req() req: AnyAuthRequest): Promise<TenantInfo> {
    const { payload, user, identifier, tenant, profile } = req;
    this.logger.log(`info ${r({ payload, user, identifier, tenant, profile })}`);
    return this.tenantService.info(user.id);
  }
}
