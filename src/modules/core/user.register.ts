import { BaseEntity, DeleteResult } from 'typeorm';
import { Constructor } from '../base';
import { r } from '../common/helpers';
import { LoggerFactory } from '../common/logger';
import { UserProfile } from './auth/user.entities';
import { DBHelper } from './db';

const logger = LoggerFactory.getLogger('UserRegister');

export class UserRegister {
  static Entity: Constructor<any>;
  static onProfileCreate: (profile: UserProfile) => any;
  static onProfileDelete: (profile: UserProfile) => any;

  static regCoreUserCreator<User extends BaseEntity>(
    Entity: Constructor<User>,
    onProfileCreate?: (profile: UserProfile) => any,
    onProfileDelete?: (profile: UserProfile) => any,
  ): void {
    this.Entity = Entity;
    this.onProfileCreate =
      onProfileCreate ||
      (profile => {
        const entity = new Entity({ id: profile.id, profile });
        logger.verbose(`onProfileCreate save ${r({ profile, entity })}`);
        return DBHelper.repo(Entity).save(entity as any);
      });
    this.onProfileDelete = onProfileDelete || (profile => DBHelper.repo(Entity).delete(profile.id));
  }

  static createUserByProfile(profile: UserProfile): Promise<any> {
    if (!this.Entity || !this.onProfileCreate) {
      logger.warn(`no core user registered for created.`);
    }

    return this.onProfileCreate(profile);
  }

  static removeUserByProfile(profile: UserProfile): Promise<DeleteResult> {
    if (!this.Entity || !this.onProfileDelete) {
      logger.warn(`no core user registered for removed.`);
    }

    return this.onProfileDelete(profile);
  }
}
