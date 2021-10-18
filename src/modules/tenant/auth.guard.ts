import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

import { AsunaErrorCode, AsunaException } from '@danielwii/asuna-helper/dist/exceptions';
import { LoggerFactory } from '@danielwii/asuna-helper/dist/logger/factory';
import { r } from '@danielwii/asuna-helper/dist/serializer';

import _ from 'lodash';

import { OrgAuthHelper } from './auth';
import { OrgUser } from './tenant.entities';

import type { AnyAuthRequest } from '../helper';
import type { JwtPayload } from '../core';

export type OrgJwtAuthRequest = AnyAuthRequest<JwtPayload, OrgUser>;

export enum TenantRoleName {
  admin = 'admin',
  staff = 'staff',
}

@Injectable()
export class TenantRolesGuard implements CanActivate {
  private logger = LoggerFactory.getLogger('TenantRolesGuard');

  public constructor(private readonly oneOf: TenantRoleName[]) {}

  public async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<OrgJwtAuthRequest>();
    const tenant = req.tenant;
    if (!tenant) throw new AsunaException(AsunaErrorCode.InsufficientPermissions, 'no tenant found');

    // const user = await OrgUser.findOne({where:{id:req.}})
    // const roles = OrgRole.find({ where: { users: In([req.user.id]) } });
    // this.logger.log(`found user ${r(req.user)}`);

    if (
      _.isEmpty(
        _.intersection(
          this.oneOf,
          req.roles.map((role) => role.name),
        ),
      )
    ) {
      throw new AsunaException(AsunaErrorCode.InsufficientPermissions, `role not matched: ${_.join(this.oneOf, ',')}`);
    }

    return true;
  }
}

@Injectable()
export class OrgJwtAuthGuard extends AuthGuard('org-jwt') {
  private logger = LoggerFactory.getLogger('OrgJwtAuthGuard');

  public constructor(private readonly opts: { anonymousSupport: boolean } = { anonymousSupport: false }) {
    super();
  }

  // @ts-ignore
  public async handleRequest(err, payload: JwtPayload, info, context: ExecutionContext) {
    const req = context.switchToHttp().getRequest<OrgJwtAuthRequest>();
    const res = context.switchToHttp().getResponse();
    if (err || !payload) {
      if (this.opts.anonymousSupport) {
        return undefined;
      }
      throw err || new AsunaException(AsunaErrorCode.InsufficientPermissions, 'org jwt auth failed', info);
    }
    this.logger.log(`handleRequest ${r({ err, payload, info })}`);
    await OrgAuthHelper.populate(req, payload);
    return req.user;
  }
}
