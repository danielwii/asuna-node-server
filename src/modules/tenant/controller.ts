import { Controller, Get, Logger, Req, UseGuards } from '@nestjs/common';

import { resolveModule } from '@danielwii/asuna-helper/dist/logger/factory';
import { r } from '@danielwii/asuna-helper/dist/serializer';

import { Promise } from 'bluebird';

import { JwtAuthGuard } from '../core/auth/auth.guard';
import { TenantHelper, TenantInfo } from './tenant.helper';

import type { AnyAuthRequest } from '../helper/interfaces';

@Controller('api/v1/tenant')
export class TenantController {
  private readonly logger = new Logger(resolveModule(__filename, TenantController.name));

  @UseGuards(new JwtAuthGuard())
  @Get('info')
  async info(@Req() req: AnyAuthRequest): Promise<TenantInfo> {
    const { payload, user, identifier, tenant, profile } = req;
    this.logger.log(`info ${r({ payload, user, identifier, tenant, profile })}`);
    return TenantHelper.info(user.id);
  }
}
