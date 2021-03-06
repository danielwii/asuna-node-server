import { LoggerFactory } from '@danielwii/asuna-helper/dist/logger';

import _ from 'lodash';
import ow from 'ow';
import { BaseEntity, FindOneOptions } from 'typeorm';

import { AsunaErrorCode, AsunaException } from '@danielwii/asuna-helper/dist/exceptions';
import { DBHelper } from '../db/db.helper';
import { UserRegister } from '../user.register';
import { UserProfile } from './user.entities';

const logger = LoggerFactory.getLogger('AuthedUserHelper');

export class AuthedUserHelper {
  static async createProfile(profile: UserProfile): Promise<any> {
    const saved = await profile.save();
    const user = await UserRegister.createUserByProfile(saved).catch((reason) => logger.error(reason));
    return [saved, user];
  }

  static getProfileById(id: string | number, options?: FindOneOptions<UserProfile>): Promise<UserProfile> {
    // console.log(`AuthedUserHelper.getProfileById ${id}`);
    if (typeof id === 'number') {
      // ow(id, 'id', ow.number.integer);
      return UserProfile.findOneOrFail(`u${id}`);
    }
    ow(id, 'id', ow.string.nonEmpty);
    return UserProfile.findOneOrFail(id, options);
  }

  static getProfile(
    { email, username }: { username?: string; email?: string },
    options?: FindOneOptions<UserProfile>,
  ): Promise<UserProfile> {
    if (!email && !email) {
      throw new AsunaException(AsunaErrorCode.BadRequest, `email or username must not both be empty`);
    }

    return UserProfile.findOneOrFail({ username, email }, options);
  }

  static async getUserById<User>(id: string | number, options?: FindOneOptions<User>): Promise<User> {
    if (typeof id === 'number') {
      // ow(id, 'id', ow.number.integer);
      return (UserRegister.Entity as typeof BaseEntity).findOneOrFail(id, options as any) as any;
    }
    ow(id, 'id', ow.string.nonEmpty);
    const entity = await UserRegister.Entity.findOne({ cache: true });
    const fixedId = _.isNumber(entity.id) ? Number(id.slice(1)) : id;
    return (UserRegister.Entity as typeof BaseEntity).findOneOrFail(fixedId, options as any) as any;
  }

  static async getProfileByUserId(userId: string): Promise<UserProfile> {
    const user: any = await (UserRegister.Entity as typeof BaseEntity).findOneOrFail(userId);
    return UserProfile.findOne(user.profileId);
  }

  static getUserByProfileId<User = any>(profileId: string, relations?: string[]): Promise<User> {
    ow(profileId, 'profileId', ow.string.nonEmpty);
    // const existRelations = DBHelper.getRelationPropertyNames(UserRegister.Entity);
    return (UserRegister.Entity as typeof BaseEntity).findOneOrFail({ where: { profileId }, relations }) as any;
  }

  static getUser<User>({ email, username }: { username?: string; email?: string }): Promise<User> {
    if (!email && !username) {
      throw new AsunaException(AsunaErrorCode.BadRequest, `email or username must not both be empty`);
    }

    const columns = DBHelper.getColumnNames(UserRegister.Entity);
    if (email && !columns.includes('email')) {
      throw new AsunaException(AsunaErrorCode.BadRequest, `email not included in ${UserRegister.Entity}`);
    }

    if (username && !columns.includes('username')) {
      throw new AsunaException(AsunaErrorCode.BadRequest, `username not included in ${UserRegister.Entity}`);
    }

    return (UserRegister.Entity as typeof BaseEntity).findOneOrFail(_.pick({ email, username }, columns) as any) as any;
  }
}
