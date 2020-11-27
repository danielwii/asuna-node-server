import { Injectable } from '@nestjs/common';
import { InjectConnection } from '@nestjs/typeorm';
import * as _ from 'lodash';
import { Connection, In } from 'typeorm';

import { LoggerFactory } from '../common/logger/factory';
import { OrgRole, OrgUser } from './tenant.entities';
import { AbstractAuthService, AuthUserChannel, CreatedUser, PasswordHelper } from '../core/auth';
import { r } from '../common/helpers/utils';

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
