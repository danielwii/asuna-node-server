import { Injectable } from '@nestjs/common';
import { InjectConnection } from '@nestjs/typeorm';
import * as _ from 'lodash';
import * as shortid from 'shortid';
import { Connection, getManager } from 'typeorm';

import { r } from '../../common/helpers';
import { LoggerFactory } from '../../common/logger';
import { AbstractAuthService, PasswordHelper } from './abstract.auth.service';
import { SYS_ROLE } from './auth.constants';
import { AdminUser } from './auth.entities';
import { RoleRepository } from './auth.repositories';
import { AppConfigObject } from '../../config/app.config';
import { AuthUserChannel } from './base.entities';

import type { CreatedUser } from './auth.service';

const logger = LoggerFactory.getLogger('AdminAuthService');

@Injectable()
export class AdminAuthService extends AbstractAuthService<AdminUser> {
  private readonly roleRepository: RoleRepository;

  public constructor(@InjectConnection() private readonly connection: Connection) {
    super(AdminUser, connection.getRepository<AdminUser>(AdminUser));
    this.roleRepository = connection.getCustomRepository(RoleRepository);
  }

  public async createUser(
    username: string,
    email: string,
    password: string,
    channel?: AuthUserChannel,
    roleNames?: string[],
  ): Promise<CreatedUser<AdminUser>> {
    const { hash, salt } = PasswordHelper.encrypt(password);
    const roles = _.isEmpty(roleNames) ? null : await this.roleRepository.findByNames(roleNames);

    let user = await this.getUser({ username, email });
    if (!user) {
      user = this.authUserRepository.create({ email, username, isActive: true });
    }
    logger.log(`found user ${r(user)}`);
    user.password = hash;
    user.salt = salt;
    user.roles = roles;
    return getManager()
      .save(user)
      .then((user) => ({ user }));
  }

  /**
   * 保证 SYS_ADMIN 角色存在并保证该角色至少拥有一个用户
   * 如果没有则创建预设用户 admin@example.com - password
   * @returns {Promise<void>}
   */
  public async initSysAccount(): Promise<void> {
    const email = AppConfigObject.load().sysAdminEmail;
    const password = AppConfigObject.load().sysAdminPassword ?? shortid.generate();
    const role = await this.roleRepository.findOne({ name: SYS_ROLE });

    if (!role) {
      const entity = this.roleRepository.create({ name: SYS_ROLE });
      await getManager().save(entity);
    }
    logger.log(`found sys role: ${!!role}`);

    const sysRole = await this.roleRepository.findOne({
      where: { name: SYS_ROLE },
      relations: ['users'],
    });
    logger.log(`found sys role: ${r(sysRole)}`);
    logger.log(`found users for sys role: ${sysRole.users.length}`);
    if (sysRole.users.length === 0) {
      await AdminUser.delete({ email });
      await AdminUser.delete({ email: 'admin@example.com' });

      logger.log(`---------------------------------------------------------------`);
      logger.log(`create SYS_ADMIN account: ${email}:${password}`);
      logger.log(`---------------------------------------------------------------`);
      this.createUser('Administrator', email, password, undefined, [SYS_ROLE]).catch((error) => {
        logger.warn('cannot create default SYS_ADMIN account', error);
      });
    }
  }
}
