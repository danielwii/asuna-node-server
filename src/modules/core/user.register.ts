import { Logger } from '@nestjs/common';

import { r } from '@danielwii/asuna-helper/dist/serializer';

import _ from 'lodash';

import { DBHelper } from './db/db.helper';

import type { ConstrainedConstructor } from '@danielwii/asuna-helper/dist/interface';
import type { BaseEntity } from 'typeorm';
import type { UserProfile } from './auth/user.entities';

export class UserRegister {
  public static Entity: ConstrainedConstructor<any> | any;
  public static onProfileCreate: (profile: UserProfile) => Promise<any>;
  public static onProfileDelete: (profile: UserProfile) => Promise<any>;

  public static regCoreUserCreator<User extends BaseEntity>(
    Entity: ConstrainedConstructor<any> | any,
    onProfileCreate?: (profile: UserProfile) => Promise<any>,
    onProfileDelete?: (profile: UserProfile) => Promise<any>,
  ): void {
    Logger.log(`reg user for profile create: ${Entity.name}`);

    this.Entity = Entity;
    this.onProfileCreate =
      onProfileCreate ??
      ((profile) => {
        const entity = _.has(Entity, 'of')
          ? Entity.of({ id: profile.id, profile })
          : new Entity({ id: profile.id, profile });
        Logger.debug(`onProfileCreate save ${r({ profile, entity })}`);
        return DBHelper.repo(Entity).save(entity as any);
      });
    this.onProfileDelete = onProfileDelete ?? ((profile) => DBHelper.repo(Entity).delete(profile.id));
  }

  public static createUserByProfile(profile: UserProfile): Promise<any> {
    Logger.log(`create user by profile ${r(profile)}`);
    if (!this.Entity || !this.onProfileCreate) {
      Logger.warn(`no core user registered for created.`);
      return Promise.reject(new Error(`no core user registered for created.`));
    }
    return this.onProfileCreate(profile);
  }

  public static removeUserByProfile(profile: UserProfile): Promise<any> {
    Logger.log(`remove user by profile ${r(profile)}`);
    if (!this.Entity || !this.onProfileDelete) {
      Logger.warn(`no core user registered for removed.`);
      return Promise.reject(new Error(`no core user registered for removed.`));
    }
    return this.onProfileDelete(profile);
  }
}
