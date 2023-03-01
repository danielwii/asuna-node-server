import { Controller, Get, Logger, Query } from '@nestjs/common';

import { resolveModule } from '@danielwii/asuna-helper/dist/logger/factory';
import { r } from '@danielwii/asuna-helper/dist/serializer';
import { ApiResponse } from '@danielwii/asuna-shared/dist/vo';

import { fileURLToPath } from 'node:url';

import _ from 'lodash';

import { CacheTTL } from '../cache';
import { named } from '../helper/annotations';
import { AppInfo, AppRelease } from './app.entities';

import type { FindOptionsWhere } from 'typeorm';

@Controller('api/v1/app')
export class AppController {
  private readonly logger = new Logger(resolveModule(fileURLToPath(import.meta.url), this.constructor.name));

  @Get('latest-release')
  @named
  public async getLatestRelease(
    @Query('key') key: string,
    @Query('platform') platform?: string,
    funcName?: string,
  ): Promise<ApiResponse> {
    this.logger.log(`#${funcName}: ${r({ key, platform })}`);

    const appInfo = await AppInfo.findOne({ where: { key, isPublished: true }, cache: CacheTTL.FLASH });
    const release = await AppRelease.findOne({
      where: {
        appInfoId: appInfo?.id,
        platform: platform?.toUpperCase(),
        isPublished: true,
      } as FindOptionsWhere<AppRelease>,
      order: { id: 'DESC' },
      cache: CacheTTL.FLASH,
    });
    this.logger.log(`#${funcName}: ${r({ appInfo, release })}`);
    return ApiResponse.success(_.pick(release, 'versionCode', 'platform', 'buildNumber', 'url'));
  }
}
