import { Injectable } from '@nestjs/common';
import { InjectConnection } from '@nestjs/typeorm';
import * as _ from 'lodash';
import * as shortid from 'shortid';
import { Connection, getManager } from 'typeorm';
import { r } from '../../common/helpers';
import { LoggerFactory } from '../../common/logger';
import { ConfigKeys, configLoader } from '../../config';
import { AbstractAuthService } from './abstract.auth.service';
import { SYS_ROLE } from './auth.constants';
import { AdminUser } from './auth.entities';
import { RoleRepository } from './auth.repositories';

const logger = LoggerFactory.getLogger('AdminAuthService');

@Injectable()
export class AdminAuthService extends AbstractAuthService {
  private readonly roleRepository: RoleRepository;

  constructor(@InjectConnection() private readonly connection: Connection) {
    super(connection.getRepository<AdminUser>(AdminUser) as any);
    this.roleRepository = connection.getCustomRepository(RoleRepository);
  }

  async createUser(username: string, email: string, password: string, roleNames?: string[]): Promise<AdminUser> {
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
  async initSysAccount(): Promise<void> {
    const email = configLoader.loadConfig(ConfigKeys.SYS_ADMIN_EMAIL, 'admin@example.com');
    const password = configLoader.loadConfig(ConfigKeys.SYS_ADMIN_PASSWORD, shortid.generate());
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
    if (usersBySysRole.length === 0) {
      logger.log(`---------------------------------------------------------------`);
      logger.log(`create SYS_ADMIN account: ${email}:${password}`);
      logger.log(`---------------------------------------------------------------`);
      this.createUser('Administrator', email, password, [SYS_ROLE]).catch(error => {
        logger.warn('cannot create default SYS_ADMIN account', error);
      });
    }
  }
}
