import { AsunaErrorCode, AsunaException } from '@danielwii/asuna-helper/dist/exceptions';
import { LoggerFactory } from '@danielwii/asuna-helper/dist/logger/factory';

import _ from 'lodash';
import ow from 'ow';

import { DBHelper } from '../db/db.helper';
import { UserRegister } from '../user.register';
import { UserProfile } from './user.entities';

import type { FindOptionsWhere } from 'typeorm/find-options/FindOptionsWhere';
import type { FindOneOptions } from 'typeorm';

const logger = LoggerFactory.getLogger('AuthedUserHelper');

export class AuthedUserHelper {
  static async createProfile(profile: UserProfile): Promise<any> {
    const saved = await profile.save();
    const user = await UserRegister.createUserByProfile(saved).catch((reason) => logger.error(reason));
    return [saved, user];
  }

  static getProfileById(
    id: string | number,
    options?: Exclude<FindOneOptions<UserProfile>, 'where'>,
  ): Promise<UserProfile> {
    // console.log(`AuthedUserHelper.getProfileById ${id}`);
    if (typeof id === 'number') {
      // ow(id, 'id', ow.number.integer);
      return UserProfile.findOneByOrFail({ id: `u${id}` });
    }
    ow(id, 'id', ow.string.nonEmpty);
    return UserProfile.findOneOrFail({ where: { id } as any, ...options });
  }

  static getProfile(
    { email, username }: { username?: string; email?: string },
    options?: Exclude<FindOneOptions<UserProfile>, 'where'>,
  ): Promise<UserProfile> {
    if (!email && !username) {
      throw new AsunaException(AsunaErrorCode.BadRequest, `email or username must not both be empty`);
    }

    return UserProfile.findOneOrFail({ where: { username, email } as any, ...options });
  }

  static async getUserById<User>(id: string | number, options?: Exclude<FindOneOptions<User>, 'where'>): Promise<User> {
    if (typeof id === 'number') {
      // ow(id, 'id', ow.number.integer);
      return UserRegister.Entity.findOneOrFail({ where: { id }, ...options });
    }
    ow(id, 'id', ow.string.nonEmpty);
    logger.log(`get user by id ${id}`);
    const entity = await UserRegister.Entity.findOneById(id);
    const fixedId = _.isNumber(entity.id) ? Number(id.slice(1)) : id;
    return UserRegister.Entity.findOneOrFail({ where: { id: fixedId }, ...options });
  }

  static async getProfileByUserId(userId: string): Promise<UserProfile> {
    const user: any = await UserRegister.Entity.findOneByOrFail({ id: userId });
    return UserProfile.findOneById(user.profileId);
  }

  static getUserByProfileId<User = any>(profileId: string, relations?: string[]): Promise<User> {
    ow(profileId, 'profileId', ow.string.nonEmpty);
    // const existRelations = DBHelper.getRelationPropertyNames(UserRegister.Entity);
    return UserRegister.Entity.findOneOrFail({ where: { profileId }, relations });
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

    return UserRegister.Entity.findOneOrFail(_.pick({ email, username }, columns));
  }
}
