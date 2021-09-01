import { Controller, Get, Req, UseGuards } from '@nestjs/common';

import { LoggerFactory } from '@danielwii/asuna-helper/dist/logger';
import { r } from '@danielwii/asuna-helper/dist/serializer';

import { Promise } from 'bluebird';

import { JwtAuthGuard } from '../core/auth/auth.guard';
import { TenantHelper, TenantInfo } from './tenant.helper';

import type { AnyAuthRequest } from '../helper/interfaces';

const logger = LoggerFactory.getLogger('TenantController');

@Controller('api/v1/tenant')
export class TenantController {
  @UseGuards(JwtAuthGuard)
  @Get('info')
  async info(@Req() req: AnyAuthRequest): Promise<TenantInfo> {
    const { payload, user, identifier, tenant, profile } = req;
    logger.log(`info ${r({ payload, user, identifier, tenant, profile })}`);
    return TenantHelper.info(user.id);
  }
}
