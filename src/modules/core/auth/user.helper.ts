import * as _ from 'lodash';
import ow from 'ow';
import { BaseEntity } from 'typeorm';
import { AsunaErrorCode, AsunaException, LoggerFactory } from '../../common';
import { DBHelper } from '../db';
import { UserRegister } from '../user.register';
import { UserProfile } from './user.entities';

const logger = LoggerFactory.getLogger('AuthedUserHelper');

export class AuthedUserHelper {
  static async createProfile(profile: UserProfile): Promise<any> {
    const saved = await profile.save();
    const user = await UserRegister.createUserByProfile(saved).catch((reason) => logger.error(reason));
    return [saved, user];
  }

  static getProfileById(id: string | number): Promise<UserProfile> {
    // console.log(`AuthedUserHelper.getProfileById ${id}`);
    if (typeof id === 'number') {
      // ow(id, 'id', ow.number.integer);
      return UserProfile.findOneOrFail(`u${id}`);
    }
    ow(id, 'id', ow.string.nonEmpty);
    return UserProfile.findOneOrFail(id);
  }

  static getProfile({ email, username }: { username?: string; email?: string }): Promise<UserProfile> {
    if (!email && !email) {
      throw new AsunaException(AsunaErrorCode.BadRequest, `email or username must not both be empty`);
    }

    return UserProfile.findOneOrFail({ username, email });
  }

  static getUserById<User>(id: string | number): Promise<User> {
    if (typeof id === 'number') {
      // ow(id, 'id', ow.number.integer);
      return (UserRegister.Entity as typeof BaseEntity).findOneOrFail(id) as any;
    }
    ow(id, 'id', ow.string.nonEmpty);
    return (UserRegister.Entity as typeof BaseEntity).findOneOrFail(+id.slice(1)) as any;
  }

  static getUser<User>({ email, username }: { username?: string; email?: string }): Promise<User> {
    if (!email && !email) {
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
