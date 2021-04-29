import { Injectable } from '@nestjs/common';
import { InjectConnection } from '@nestjs/typeorm';

import { LoggerFactory } from '@danielwii/asuna-helper/dist/logger';
import { r } from '@danielwii/asuna-helper/dist/serializer';

import _ from 'lodash';
import { Connection, In } from 'typeorm';

import { AbstractAuthService, AuthUserChannel, CreatedUser, PasswordHelper } from '../core/auth';
import { OrgRole, OrgUser } from './tenant.entities';

const logger = LoggerFactory.getLogger('OrgUserAuthService');

@Injectable()
export class TenantAuthService extends AbstractAuthService<OrgUser> {
  public constructor(@InjectConnection() private readonly connection: Connection) {
    super(OrgUser, connection.getRepository<OrgUser>(OrgUser));
  }

  public async createUser(
    username: string,
    email: string,
    password: string,
    channel?: AuthUserChannel,
    roleNames?: string[],
  ): Promise<CreatedUser<OrgUser>> {
    const { hash, salt } = PasswordHelper.encrypt(password);
    const roles = _.isEmpty(roleNames) ? null : await OrgRole.find({ name: In(roleNames) });

    const user = await this.getUser({ username, email });
    if (user) {
      logger.log(`found user ${r(user)}`);
      return { user };
    }

    return this.authUserRepository
      .create({ email, username, isActive: true, password: hash, salt, roles })
      .save()
      .then((user) => ({ user }));
  }
}
