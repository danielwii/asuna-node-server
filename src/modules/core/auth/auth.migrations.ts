import { Logger } from '@nestjs/common';

import { SimpleIdGenerator } from '../../ids';
import { MigrationsHelper } from '../migrations/migrations.helper';
import { AdminUser } from './auth.entities';

import type { NestExpressApplication } from '@nestjs/platform-express';

export class AuthMigrations {
  static readonly version = 1;

  /*
  static temp = {};
  static async migrateBefore(): Promise<void> {
    const key = 'AdminUser';
    const currentVersion = await MigrationsHelper.getVersion(key);
    logger.log(`migrateBefore: check versions for ${key} '${currentVersion}' with '${this.version}'`);
    if (currentVersion < this.version) {
      // eslint-disable-next-line no-restricted-syntax
      for (const user of await AdminUser.find()) {
        this.temp[`${user.email}:${user.username}`] = user.id;
      }
    }
  }
*/

  static async migrate(app: NestExpressApplication): Promise<void> {
    const key = 'AdminUser';
    const currentVersion = await MigrationsHelper.getVersion(app, key);
    Logger.log(`migrate: check versions for '${key}' '${currentVersion}' with '${this.version}'`);
    if (currentVersion < this.version) {
      Logger.log(`migrate: run migrations for '${key}' ...`);
      // eslint-disable-next-line no-restricted-syntax
      for (const user of await AdminUser.find()) {
        if (!user.id) {
          user.id = new SimpleIdGenerator('sa').nextId();
          // eslint-disable-next-line no-await-in-loop
          await user.save();
        }
      }
      await MigrationsHelper.updateVersion(app, AdminUser.name, this.version);
      Logger.log(`migrate: run migrations for '${key}' done, update version to '${this.version}' ...`);
    }
  }
}
