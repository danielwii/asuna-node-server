import { Injectable } from '@nestjs/common';
import { InjectConnection } from '@nestjs/typeorm';
import { Connection, getManager, Repository } from 'typeorm';

import { AsunaErrorCode, AsunaException } from '../../common/exceptions';
import { r } from '../../common/helpers';
import { LoggerFactory } from '../../common/logger';
import { Hermes } from '../bus';
import { DBHelper } from '../db';
import { AbstractAuthService, PasswordHelper } from './abstract.auth.service';
import { AdminUser } from './auth.entities';
import { AbstractAuthUser, AbstractTimeBasedAuthUser, AuthUser } from './base.entities';
import { UserProfile } from './user.entities';

const logger = LoggerFactory.getLogger('AuthService');

export const HermesAuthEventKeys = {
  // 新用户
  userCreated: 'user.created',
};

@Injectable()
export class AuthService extends AbstractAuthService<AuthUser> {
  /**
   * 这里会根据继承 AbstractAuthUser / AbstractTimeBasedAuthUser 的实体来注册用户
   * 目前服务端新建了 UserProfile 来接管用户认证，将业务与认证分离。
   * 所以自定义的用户注册对象在这里无法被查询器查询到并注册。
   *
   * TODO 1 - 历史 User 对象的认证数据需要迁移到 UserProfile 中
   * @param connection
   */
  constructor(@InjectConnection() private readonly connection: Connection) {
    super(
      ((): Repository<AdminUser> => {
        // 获得用户继承的 AbstractAuthUser
        const entityMetadata = connection.entityMetadatas.find(metadata =>
          DBHelper.isValidEntity(metadata)
            ? metadata.targetName !== AdminUser.name &&
              (Object.getPrototypeOf(metadata.target).name === AbstractAuthUser.name ||
                Object.getPrototypeOf(metadata.target).name === AbstractTimeBasedAuthUser.name)
            : false,
        );
        if (!entityMetadata) {
          logger.warn('no auth user repo found.');
          return null;
        }
        logger.log(`entityMetadata is ${r(entityMetadata.target)}`);
        return connection.getRepository(entityMetadata.target) as any;
      })(),
    );
  }

  async createUser(username: string, email: string, password: string): Promise<UserProfile> {
    const { hash, salt } = PasswordHelper.encrypt(password);

    const user = await this.getUser({ email, username });
    if (user) {
      logger.log(`found user ${r(user)}`);
      throw new AsunaException(AsunaErrorCode.Unprocessable, `user ${r({ username, email })} already exists.`);
    }

    return getManager()
      .save(this.userRepository.create({ email, username, isActive: true, password: hash, salt }))
      .then(result => {
        Hermes.emit(AuthService.name, HermesAuthEventKeys.userCreated, result);
        return this.userRepository.findOne(result.id) as any;
      });
  }
}
