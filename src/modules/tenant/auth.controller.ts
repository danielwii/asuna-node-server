import { Controller, Get, Req, UseGuards } from '@nestjs/common';

import { AsunaErrorCode, AsunaException } from '@danielwii/asuna-helper/dist/exceptions';
import { Hermes } from '@danielwii/asuna-helper/dist/hermes/hermes';
import { LoggerFactory } from '@danielwii/asuna-helper/dist/logger';
import { r } from '@danielwii/asuna-helper/dist/serializer';

import { Promise } from 'bluebird';

import { AbstractAuthController } from '../core/auth';
import { OrgJwtAuthGuard } from './auth.guard';
import { TenantAuthService } from './auth.service';
import { OrgUser } from './tenant.entities';

import type { DeepPartial } from 'typeorm';
import type { OrgJwtAuthRequest } from './auth';

const logger = LoggerFactory.getLogger('AuthController');

@Controller('api/v1/tenant/auth')
export class TenantAuthController extends AbstractAuthController<OrgUser> {
  constructor(public readonly authService: TenantAuthService) {
    super(OrgUser, authService);
  }

  @Get('current')
  @UseGuards(OrgJwtAuthGuard)
  async current(@Req() req: OrgJwtAuthRequest): Promise<DeepPartial<OrgUser>> {
    const { user, payload } = req;
    logger.log(`current... ${r({ user, payload })}`);
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
        logger.debug(`updateLastLoginDate ${r({ sameDay, lastLoginAt })}`);
        if (!sameDay) Hermes.emit(AbstractAuthController.name, 'user.first-login-everyday', payload);
        // !sameDay && Hermes.emit(AuthController.name, HermesUserEventKeys.firstLoginEveryday, payload);
      })
      .catch((reason) => logger.error(reason));
    logger.debug(`current authed user is ${r(loaded)}`);
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
