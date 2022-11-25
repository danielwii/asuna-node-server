import { Body, Controller, Get, Logger, Post, Req, UseGuards } from '@nestjs/common';

import { AsunaErrorCode, AsunaException } from '@danielwii/asuna-helper/dist/exceptions';
import { Hermes } from '@danielwii/asuna-helper/dist/hermes/hermes';
import { resolveModule } from '@danielwii/asuna-helper/dist/logger/factory';
import { r } from '@danielwii/asuna-helper/dist/serializer';


import { AbstractAuthController } from '../core/auth';
import { OrgJwtAuthGuard, TenantRoleName, TenantRolesGuard } from './auth.guard';
import { OrgUser } from './tenant.entities';

import type { CreateTenantStaffDTO } from '@danielwii/asuna-shared';
import { TenantAuthService } from './auth.service';
import type { DeepPartial } from 'typeorm';
import type { OrgJwtAuthRequest } from './auth';
import { fileURLToPath } from "url";

@Controller('api/v1/tenant/auth')
export class TenantAuthController extends AbstractAuthController<OrgUser> {
  private readonly logger = new Logger(resolveModule(fileURLToPath(import.meta.url), TenantAuthController.name));

  public constructor(public override readonly authService: TenantAuthService) {
    super(OrgUser, authService);
  }

  @Post('staff')
  @UseGuards(OrgJwtAuthGuard, new TenantRolesGuard([TenantRoleName.admin]))
  public async createStaff(@Body() body: CreateTenantStaffDTO, @Req() req: OrgJwtAuthRequest) {
    const { tenant } = req;
    return this.authService.createStaff(tenant.id, body);
  }

  @Get('current')
  @UseGuards(OrgJwtAuthGuard)
  public override async current(@Req() req: OrgJwtAuthRequest): Promise<DeepPartial<OrgUser>> {
    const { user, payload } = req;
    this.logger.log(`current... ${r({ user, payload })}`);
    if (!payload) {
      throw new AsunaException(AsunaErrorCode.InvalidCredentials, `user '${user.username}' not active or exist.`);
    }
    // const relations = DBHelper.getRelationPropertyNames(this.UserEntity);
    const loaded = await this.UserEntity.findOne({
      // TODO OrgUser 时没有 uid
      where: { id: payload.uid ?? payload.id },
      // maybe get relations from a register, cause user side relations won't load here.
      // relations: ['profile'],
    });
    this.authService
      .updateLastLoginDate(payload.id)
      .then(({ sameDay, lastLoginAt }) => {
        this.logger.debug(`updateLastLoginDate ${r({ sameDay, lastLoginAt })}`);
        if (!sameDay) Hermes.emit(AbstractAuthController.name, 'user.first-login-everyday', payload);
        // !sameDay && Hermes.emit(AuthController.name, HermesUserEventKeys.firstLoginEveryday, payload);
      })
      .catch((reason) => this.logger.error(reason));
    this.logger.debug(`current authed user is ${r(loaded)}`);
    /*
    const result = _.omit(loaded, 'channel', 'info'); // ...
    if (DBHelper.getColumnNames(this.UserEntity).includes('profile')) {
      const profileId = _.get(result, 'profileId');
      const profile = await UserProfile.findOne(profileId, { relations: ['wallet'] });
      _.set(result, 'profile', _.omit(profile, 'salt', 'password', 'info'));
    }
*/
    return loaded;
  }
}
