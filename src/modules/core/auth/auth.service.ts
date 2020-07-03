import { Injectable } from '@nestjs/common';
import { InjectConnection } from '@nestjs/typeorm';
import { Connection } from 'typeorm';

import { AsunaErrorCode, AsunaException } from '../../common/exceptions';
import { r } from '../../common/helpers';
import { LoggerFactory } from '../../common/logger';
import { Hermes } from '../bus';
import { AbstractAuthService, PasswordHelper } from './abstract.auth.service';
import { AuthUserChannel } from './base.entities';
import { UserProfile } from './user.entities';
import { AuthedUserHelper } from './user.helper';

const logger = LoggerFactory.getLogger('AuthService');

export const HermesAuthEventKeys = {
  // 新用户
  userCreated: 'user.created',
};

export type CreatedUser<U> = { profile: UserProfile; user: U };

@Injectable()
export class AuthService extends AbstractAuthService<UserProfile> {
  /**
   * 这里会根据继承 AbstractAuthUser / AbstractTimeBasedAuthUser 的实体来注册用户
   * 目前服务端新建了 UserProfile 来接管用户认证，将业务与认证分离。
   * 所以自定义的用户注册对象在这里无法被查询器查询到并注册。
   *
   * @param connection
   */
  constructor(@InjectConnection() private readonly connection: Connection) {
    super(
      connection.getRepository(UserProfile),
      /* 历史 User 对象的认证数据已经迁移到了 UserProfile 中
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
        logger.log(`reg auth user: ${entityMetadata.target.constructor.name}`);
        return connection.getRepository(entityMetadata.target) as any;
      })(),
    */
    );
  }

  async createUser<U>(
    username: string,
    email: string,
    password: string,
    channel?: AuthUserChannel,
  ): Promise<CreatedUser<U>> {
    const { hash, salt } = PasswordHelper.encrypt(password);

    const found = await this.getUser({ email, username });
    if (found) {
      logger.log(`found user ${r(found)}`);
      throw new AsunaException(AsunaErrorCode.Unprocessable, `user ${r({ username, email })} already exists.`);
    }

    const entity = this.userRepository.create({
      email: email || undefined,
      username: username || undefined,
      isActive: true,
      password: hash,
      salt,
      channel,
    });
    logger.debug(`create user ${r(entity)}`);
    return AuthedUserHelper.createProfile(entity).then(async ([profile, user]) => {
      logger.debug(`created ${r({ profile, user })}`);
      Hermes.emit(AuthService.name, HermesAuthEventKeys.userCreated, { profile, user });
      return { profile, user };
    });
  }

  async updateAccount(
    profileId: string,
    { username, email }: { username: string; email?: string },
  ): Promise<UserProfile> {
    const profile = await UserProfile.findOneOrFail(profileId);
    if (username) profile.username = username;
    if (email) profile.email = email;
    profile.isBound = true;
    return profile.save();
  }
}
