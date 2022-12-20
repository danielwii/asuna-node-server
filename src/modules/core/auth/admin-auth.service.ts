import { Injectable, Logger } from '@nestjs/common';

import { resolveModule } from '@danielwii/asuna-helper/dist/logger/factory';
import { r } from '@danielwii/asuna-helper/dist/serializer';

import _ from 'lodash';
import { nanoid } from 'nanoid';
import { DataSource, In } from 'typeorm';
import { fileURLToPath } from 'node:url';

import { AppConfigObject } from '../../config/app.config';
import { AbstractAuthService, PasswordHelper } from './abstract.auth.service';
import { SYS_ROLE } from './auth.constants';
import { AdminUser, Role } from './auth.entities';

import type { AuthUserChannel } from './base.entities';
import type { CreatedUser } from './auth.service';

@Injectable()
export class AdminAuthService extends AbstractAuthService<AdminUser> {
  private readonly logger = new Logger(resolveModule(fileURLToPath(import.meta.url), AdminAuthService.name));

  public constructor(private readonly dataSource: DataSource) {
    super(AdminUser, dataSource.getRepository<AdminUser>(AdminUser));
  }

  public async createUser(
    username: string,
    email: string,
    password: string,
    channel?: AuthUserChannel,
    roleNames?: string[],
  ): Promise<CreatedUser<AdminUser>> {
    const { hash, salt } = PasswordHelper.encrypt(password);
    const roles = _.isEmpty(roleNames) ? null : await Role.findBy({ name: In(roleNames) });

    let user = await this.getUser({ username, email });
    if (!user) {
      user = this.authUserRepository.create({ email, username, isActive: true });
    }
    this.logger.log(`found user ${r(user)}`);
    user.password = hash;
    user.salt = salt;
    user.roles = roles;
    this.logger.log(`update user with roles ${r({ roleNames, roles })}`);
    return this.dataSource.manager.save(user).then((user) => ({ user }));
  }

  /**
   * 保证 SYS_ADMIN 角色存在并保证该角色至少拥有一个用户
   * 如果没有则创建预设用户 admin@example.com - password
   * @returns {Promise<void>}
   */
  public async initSysAccount(): Promise<void> {
    const email = AppConfigObject.load().sysAdminEmail;
    const password = AppConfigObject.load().sysAdminPassword ?? nanoid();
    const role = await Role.findOneBy({ name: SYS_ROLE });

    if (!role) {
      const entity = Role.create({ name: SYS_ROLE });
      await this.dataSource.manager.save(entity);
    }
    this.logger.log(`found sys role: ${!!role}`);

    const sysRole = await Role.findOne({ where: { name: SYS_ROLE }, relations: ['users'] });
    this.logger.log(`found sys role: ${r(sysRole)}`);
    this.logger.log(`found users for sys role: ${sysRole.users.length}`);
    if (sysRole.users.length === 0) {
      await AdminUser.delete({ email });
      await AdminUser.delete({ email: 'admin@example.com' });

      this.logger.log(`---------------------------------------------------------------`);
      this.logger.log(`create SYS_ADMIN account: ${email}:${password}`);
      this.logger.log(`---------------------------------------------------------------`);
      this.createUser('Administrator', email, password, undefined, [SYS_ROLE]).catch((error) => {
        this.logger.warn('cannot create default SYS_ADMIN account', error);
      });
    }
  }
}
