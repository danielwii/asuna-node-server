import { Injectable, Logger } from '@nestjs/common';
import { InjectConnection } from '@nestjs/typeorm';
import * as jwt from 'jsonwebtoken';
import { Cryptor } from 'node-buffs';
import { Connection, FindOneOptions, getManager, Repository } from 'typeorm';

import { ConfigKeys, configLoader } from '../../helpers';
import { SYS_ROLE } from './auth.constants';
import { AdminUser } from './auth.entities';
import { IJwtPayload } from './auth.interfaces';
import { RoleRepository } from './auth.repositories';

const logger = new Logger('AdminAuthService');

@Injectable()
export class AdminAuthService {
  private readonly userRepository: Repository<AdminUser>;
  private readonly roleRepository: RoleRepository;
  private readonly cryptor = new Cryptor();

  constructor(
    @InjectConnection()
    private readonly connection: Connection,
  ) {
    this.userRepository = connection.getRepository(AdminUser);
    this.roleRepository = connection.getCustomRepository(RoleRepository);
  }

  encrypt(password: string) {
    return this.cryptor.passwordEncrypt(password);
  }

  passwordVerify(password: string, user: AdminUser) {
    logger.log(`passwordVerify(${password}, ${JSON.stringify(user)})`);
    return this.cryptor.passwordCompare(password, user.password, user.salt);
  }

  async createUser(username: string, email: string, password: string, roleNames: string[]) {
    const { hash, salt } = this.encrypt(password);
    const roles = await this.roleRepository.findByNames(roleNames);

    let user = await this.getUser(email);
    if (!user) {
      user = this.userRepository.create({ email, username, isActive: true });
    }
    logger.log(`found user ${JSON.stringify(user)}`);
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
    logger.log(`found sys role: ${JSON.stringify(sysRole)}`);
    const usersBySysRole = await sysRole.users;
    logger.log(`found users for sys role: ${usersBySysRole.length}`);
    if (!usersBySysRole.length) {
      logger.log('create SYS_ADMIN account: admin@example.com:password');
      this.createUser('Admin', 'admin@example.com', 'password', [SYS_ROLE]).catch(e => {
        logger.warn('cannot create default SYS_ADMIN account', e);
      });
    }
  }

  /**
   * TODO using env instead
   * @returns {Promise<void>}
   */
  async createToken(user: AdminUser) {
    logger.log(`createToken >> ${user.email}`);
    const expiresIn = 60 * 60 * 24 * 30;
    const secretOrKey = configLoader.loadConfig(ConfigKeys.SECRET_KEY, 'secret');
    const payload = { id: user.id, username: user.username, email: user.email };
    const token = jwt.sign(payload, secretOrKey, { expiresIn });
    return {
      expiresIn,
      accessToken: token,
    };
  }

  /**
   * TODO using db repo instead
   * @param jwtPayload
   * @returns {Promise<boolean>}
   */
  async validateUser(jwtPayload: IJwtPayload): Promise<boolean> {
    const left = Math.floor(jwtPayload.exp - Date.now() / 1000);
    logger.log(`validateUser >> ${JSON.stringify(jwtPayload)} expired in: ${left}s`);

    const user = await this.getUser(jwtPayload.email, true);

    return user != null && user.id === jwtPayload.id;
  }

  public getUser(email: string, isActive?: boolean, options?: FindOneOptions<AdminUser>) {
    return this.userRepository.findOne({ email, isActive }, options);
  }

  public getUserWithPassword(email: string, isActive?: boolean) {
    return this.userRepository.findOne(
      { email, isActive },
      { select: ['id', 'username', 'email', 'password', 'salt'] },
    );
  }

  public updatePassword(id: number, password: string, salt: string) {
    return this.userRepository.update(id, { password, salt });
  }
}
