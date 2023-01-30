import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';

import { resolveModule } from '@danielwii/asuna-helper/dist/logger/factory';
import { r } from '@danielwii/asuna-helper/dist/serializer';

import Chance from 'chance';
import _ from 'lodash';
// @ts-ignore
import ow from 'ow';
import { DataSource, In } from 'typeorm';

import { AbstractAuthService, AuthUserChannel, CreatedUser, PasswordHelper } from '../core/auth';
import { TenantRoleName } from './auth.guard';
import { OrgRole, OrgUser } from './tenant.entities';

import type { CreateStaffVO } from '@danielwii/asuna-shared';
import { fileURLToPath } from "url";

const chance = new Chance();

@Injectable()
export class TenantAuthService extends AbstractAuthService<OrgUser> {
  private readonly logger = new Logger(resolveModule(fileURLToPath(import.meta.url), this.constructor.name));

  public constructor(@InjectDataSource() private readonly dataSource: DataSource) {
    super(OrgUser, dataSource.getRepository<OrgUser>(OrgUser));

    _.values(TenantRoleName).forEach((name) =>
      OrgRole.findOne({ where: { name } }).then((exists) => (!exists ? OrgRole.create({ name }).save() : exists)),
    );
  }

  public async createUser(
    username: string,
    email: string,
    password: string,
    channel?: AuthUserChannel,
    // roleNames?: string[],
  ): Promise<CreatedUser<OrgUser>> {
    const roleNames = [TenantRoleName.admin];
    this.logger.log(`createUser ${r({ username, email, channel, roleNames })}`);
    const { hash, salt } = PasswordHelper.encrypt(password);
    const roles = _.isEmpty(roleNames) ? null : await OrgRole.findBy({ name: In(roleNames) });

    const user = await this.getUser({ username, email });
    if (user) {
      this.logger.log(`found user ${r(user)}`);
      return { user };
    }

    return this.authUserRepository
      .create({ email, username, isActive: true, password: hash, salt, roles })
      .save()
      .then((user) => ({ user }));
  }

  /**
   * 根据 tenant id 创建组织下的用户，并且随机生成一个密码
   * @param tenantId
   * @param username
   * @param email
   * @param nickname
   * @param password 不传输一个初始化密码的时候会自动生成一个 16 位的密码
   */
  public async createStaff(
    tenantId: string,
    { nickname, username, email, password }: { username: string; email: string; nickname?: string; password?: string },
  ): Promise<CreateStaffVO<OrgUser>> {
    ow(tenantId, 'tenantId', ow.string.nonEmpty);
    ow(username, 'username', ow.string.nonEmpty);
    ow(email, 'email', ow.string.nonEmpty);

    this.logger.log(`createStaff ${r({ tenantId, username, email, nickname, password })}`);
    const staff = await this.getUser({ username, email });
    if (staff) {
      this.logger.log(`found staff ${r(staff)}`);
      return { staff };
    }

    const generatedPassword = password ?? chance.string({ length: 16 });
    const { hash, salt } = PasswordHelper.encrypt(generatedPassword);
    const role = await OrgRole.findOne({ where: { name: TenantRoleName.staff } });
    return this.authUserRepository
      .create({ tenantId, email, username, isActive: true, password: hash, salt, roles: [role] })
      .save()
      .then((staff) => ({ staff, password: generatedPassword }));
  }
}
