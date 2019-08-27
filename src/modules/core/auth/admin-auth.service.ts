import { Injectable } from '@nestjs/common';
import { InjectConnection } from '@nestjs/typeorm';
import * as _ from 'lodash';
import { Connection, getManager } from 'typeorm';
import { r } from '../../common/helpers';
import { LoggerFactory } from '../../common/logger';
import { AbstractAuthService } from './abstract.auth.service';
import { SYS_ROLE } from './auth.constants';
import { AdminUser } from './auth.entities';
import { RoleRepository } from './auth.repositories';

const logger = LoggerFactory.getLogger('AdminAuthService');

@Injectable()
export class AdminAuthService extends AbstractAuthService {
  private readonly roleRepository: RoleRepository;

  constructor(
    @InjectConnection()
    private readonly connection: Connection,
  ) {
    super(connection.getRepository(AdminUser) as any);
    this.roleRepository = connection.getCustomRepository(RoleRepository);
  }

  async createUser(
    username: string,
    email: string,
    password: string,
    roleNames?: string[],
  ): Promise<AdminUser> {
    const { hash, salt } = this.encrypt(password);
    const roles = _.isEmpty(roleNames) ? null : await this.roleRepository.findByNames(roleNames);

    let user = (await this.getUser({ username, email })) as AdminUser;
    if (!user) {
      user = this.userRepository.create({ email, username, isActive: true }) as AdminUser;
    }
    logger.log(`found user ${r(user)}`);
    user.password = hash;
    user.salt = salt;
    user.roles = roles;
    return getManager().save(user);
  }

  /**
   * 保证 SYS_ADMIN 角色存在并保证该角色至少拥有一个用户
   * 如果没有则创建预设用户 admin@example.com - password
   * @returns {Promise<void>}
   */
  async initSysAccount() {
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
    const usersBySysRole = await sysRole.users;
    logger.log(`found users for sys role: ${usersBySysRole.length}`);
    if (!usersBySysRole.length) {
      logger.log('create SYS_ADMIN account: admin@example.com:password');
      this.createUser('Admin', 'admin@example.com', 'password', [SYS_ROLE]).catch(e => {
        logger.warn('cannot create default SYS_ADMIN account', e);
      });
    }
  }
}
