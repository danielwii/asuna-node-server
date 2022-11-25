import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';

import { AsunaErrorCode, AsunaException } from '@danielwii/asuna-helper/dist/exceptions';
import { Hermes } from '@danielwii/asuna-helper/dist/hermes/hermes';
import { resolveModule } from '@danielwii/asuna-helper/dist/logger/factory';
import { r } from '@danielwii/asuna-helper/dist/serializer';

// @ts-ignore
// eslint-disable-next-line import/no-unresolved
import ow from 'ow';
import { fileURLToPath } from 'url';

import { AbstractAuthService, PasswordHelper } from './abstract.auth.service';
import { AuthUserChannel } from './base.entities';
import { UserProfile } from './user.entities';
import { AuthedUserHelper } from './user.helper';

import type { DataSource } from 'typeorm';

export const HermesAuthEventKeys = {
  // 新用户
  userCreated: 'user.created',
};

export interface CreatedUser<U> {
  profile?: UserProfile;
  user: U;
}

@Injectable()
export class AuthService extends AbstractAuthService<UserProfile> {
  private readonly logger = new Logger(resolveModule(fileURLToPath(import.meta.url), AuthService.name));

  /**
   * 这里会根据继承 AbstractAuthUser / AbstractTimeBasedAuthUser 的实体来注册用户
   * 目前服务端新建了 UserProfile 来接管用户认证，将业务与认证分离。
   * 所以自定义的用户注册对象在这里无法被查询器查询到并注册。
   *
   * @param dataSource
   */
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {
    super(
      UserProfile,
      dataSource.getRepository(UserProfile),
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
          this.logger.warn('no auth user repo found.');
          return null;
        }
        this.logger.log(`reg auth user: ${entityMetadata.target.constructor.name}`);
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
    ow(!!(username || email), 'username or email must exists', ow.boolean.true);
    if (channel === AuthUserChannel.apple) {
      ow(username, 'username', ow.string.nonEmpty);
      const entity = this.authUserRepository.create({ username, isActive: true, channel });
      this.logger.debug(`create user ${r(entity)}`);
      return AuthedUserHelper.createProfile(entity).then(async ([profile, user]) => {
        this.logger.debug(`created ${r({ profile, user })}`);
        Hermes.emit(AuthService.name, HermesAuthEventKeys.userCreated, { profile, user });
        return { profile, user };
      });
    } else {
      ow(password, 'password', ow.string.nonEmpty);
      const { hash, salt } = PasswordHelper.encrypt(password);

      const found = await this.getUser({ email, username });
      if (found) {
        this.logger.log(`found user ${r(found)}`);
        throw new AsunaException(AsunaErrorCode.Unprocessable, `user ${r({ username, email })} already exists.`);
      }

      const entity = this.authUserRepository.create({
        email: email || undefined,
        username: username || undefined,
        isActive: true,
        password: hash,
        salt,
        channel,
      });
      this.logger.debug(`create user ${r(entity)}`);
      return AuthedUserHelper.createProfile(entity).then(async ([profile, user]) => {
        this.logger.debug(`created ${r({ profile, user })}`);
        Hermes.emit(AuthService.name, HermesAuthEventKeys.userCreated, { profile, user });
        return { profile, user };
      });
    }
  }

  /*
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
*/
}
