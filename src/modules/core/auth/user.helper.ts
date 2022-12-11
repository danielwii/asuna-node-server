import { Logger } from '@nestjs/common';

import { AsunaErrorCode, AsunaException } from '@danielwii/asuna-helper/dist/exceptions';
import { r } from '@danielwii/asuna-helper/dist/serializer';

import _ from 'lodash';
// @ts-ignore
// eslint-disable-next-line import/no-unresolved
import ow from 'ow';

import { AppDataSource } from '../../datasource';
import { DBHelper } from '../db/db.helper';
import { UserRegister } from '../user.register';
import { UserProfile } from './user.entities';

import type { FindOneOptions } from 'typeorm';

export class AuthedUserHelper {
  public static async createProfile(profile: UserProfile): Promise<any> {
    const saved = await profile.save();
    const user = await UserRegister.createUserByProfile(saved).catch((reason) => Logger.error(reason));
    return [saved, user];
  }

  public static getProfileById(
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

  public static getProfile(
    { email, username }: { username?: string; email?: string },
    options?: Exclude<FindOneOptions<UserProfile>, 'where'>,
  ): Promise<UserProfile> {
    if (!email && !username) {
      throw new AsunaException(AsunaErrorCode.BadRequest, `email or username must not both be empty`);
    }

    return UserProfile.findOneOrFail({ where: { username, email } as any, ...options });
  }

  public static async getUserById<User>(
    id: string | number,
    options?: Exclude<FindOneOptions<User>, 'where'>,
  ): Promise<User> {
    if (typeof id === 'number') {
      // ow(id, 'id', ow.number.integer);
      Logger.log(`get user by id '${id}' ${r(options)}`);
      return UserRegister.Entity.findOneOrFail({ where: { id }, ...options });
    }
    ow(id, 'id', ow.string.nonEmpty);
    Logger.log(`get user by id '${id}' ${r(options)}`);
    const entity = await UserRegister.Entity.findOne({ where: { id }, ...options });
    if (!entity) {
      throw new AsunaException(AsunaErrorCode.InvalidAuthToken, `no user found`);
    }
    return entity;
    /*
    const fixedId = _.isNumber(entity?.id) ? Number(id.slice(1)) : id;
    logger.log(`get user by fixed id '${fixedId}' ${r(options)}`);
    return UserRegister.Entity.findOneOrFail({ where: { id: fixedId }, ...options }); */
  }

  public static async getProfileByUserId(userId: string): Promise<UserProfile> {
    const user: any = await UserRegister.Entity.findOneByOrFail({ id: userId });
    return UserProfile.findOneById(user.profileId);
  }

  public static async getUserByProfileId<User = any>(profileId: string, relations?: string[]): Promise<User> {
    ow(profileId, 'profileId', ow.string.nonEmpty);
    // const existRelations = DBHelper.getRelationPropertyNames(UserRegister.Entity);
    return await UserRegister.Entity.findOneOrFail({ where: { profileId }, relations });
  }

  public static getUser<User>({ email, username }: { username?: string; email?: string }): Promise<User> {
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
