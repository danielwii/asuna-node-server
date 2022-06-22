import { Logger } from '@nestjs/common';

import { r } from '@danielwii/asuna-helper/dist/serializer';

import _ from 'lodash';
import { BaseEntity } from 'typeorm';

import { resolveModule } from '@danielwii/asuna-helper/dist/logger/factory';
import { DBHelper } from './db/db.helper';

import type { ConstrainedConstructor } from '@danielwii/asuna-helper/dist';
import type { UserProfile } from './auth/user.entities';

const logger = new Logger(resolveModule(__filename, 'UserRegister'));

export class UserRegister {
  static Entity: ConstrainedConstructor<any> | any;
  static onProfileCreate: (profile: UserProfile) => Promise<any>;
  static onProfileDelete: (profile: UserProfile) => Promise<any>;

  static regCoreUserCreator<User extends BaseEntity>(
    Entity: ConstrainedConstructor<any> | any,
    onProfileCreate?: (profile: UserProfile) => Promise<any>,
    onProfileDelete?: (profile: UserProfile) => Promise<any>,
  ): void {
    logger.log(`reg user for profile create: ${Entity.name}`);

    this.Entity = Entity;
    this.onProfileCreate =
      onProfileCreate ??
      ((profile) => {
        const entity = _.has(Entity, 'of')
          ? Entity.of({ id: profile.id, profile })
          : new Entity({ id: profile.id, profile });
        logger.debug(`onProfileCreate save ${r({ profile, entity })}`);
        return DBHelper.repo(Entity).save(entity as any);
      });
    this.onProfileDelete = onProfileDelete ?? ((profile) => DBHelper.repo(Entity).delete(profile.id));
  }

  static createUserByProfile(profile: UserProfile): Promise<any> {
    logger.log(`create user by profile ${r(profile)}`);
    if (!this.Entity || !this.onProfileCreate) {
      logger.warn(`no core user registered for created.`);
      return Promise.reject(new Error(`no core user registered for created.`));
    }
    return this.onProfileCreate(profile);
  }

  static removeUserByProfile(profile: UserProfile): Promise<any> {
    logger.log(`remove user by profile ${r(profile)}`);
    if (!this.Entity || !this.onProfileDelete) {
      logger.warn(`no core user registered for removed.`);
      return Promise.reject(new Error(`no core user registered for removed.`));
    }
    return this.onProfileDelete(profile);
  }
}
