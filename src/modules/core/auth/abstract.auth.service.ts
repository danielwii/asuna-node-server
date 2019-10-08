import { UseInterceptors } from '@nestjs/common';
import { oneLine } from 'common-tags';
import { differenceInCalendarDays, differenceInDays } from 'date-fns';
import * as jwt from 'jsonwebtoken';
import { Cryptor } from 'node-buffs';
import { User } from 'server/src/domains/user/user.entities';
import { FindOneOptions, Repository, UpdateResult } from 'typeorm';
import { formatTime, r } from '../../common/helpers';
import { ConfigKeys, configLoader } from '../../config';
import { ControllerLoggerInterceptor, LoggerFactory } from '../../common/logger';
import { IJwtPayload } from './auth.interfaces';
import { AbstractAuthUser } from './base.entities';

const logger = LoggerFactory.getLogger('AbstractAuthService');

@UseInterceptors(ControllerLoggerInterceptor)
export abstract class AbstractAuthService {
  protected readonly cryptor = new Cryptor();

  protected constructor(protected readonly userRepository: Repository<AbstractAuthUser>) {}

  encrypt(password: string) {
    return this.cryptor.passwordEncrypt(password);
  }

  passwordVerify(password: string, user: AbstractAuthUser) {
    return this.cryptor.passwordCompare(password, user.password, user.salt);
  }

  /**
   * TODO using env instead
   * @returns {Promise<void>}
   */
  async createToken(user: AbstractAuthUser) {
    logger.log(`createToken >> ${user.email}`);
    const expiresIn = 60 * 60 * 24 * 30; // one month
    const secretOrKey = configLoader.loadConfig(ConfigKeys.SECRET_KEY, 'secret');
    const payload = { id: user.id, username: user.username, email: user.email };
    const token = jwt.sign(payload, secretOrKey, { expiresIn });
    return {
      expiresIn,
      accessToken: token,
    };
  }

  /**
   * TODO using db repo instead
   * @param jwtPayload
   * @returns {Promise<boolean>}
   */
  async validateUser(jwtPayload: IJwtPayload): Promise<boolean> {
    const identifier = { email: jwtPayload.email, username: jwtPayload.username };
    const user = await this.getUser(identifier, true);

    const left = Math.floor(jwtPayload.exp - Date.now() / 1000);
    const validated = user != null && user.id === jwtPayload.id;
    if (!validated) {
      logger.verbose(oneLine`
        validated(${validated}) >> identifier: ${r(identifier)} exists: ${!!user}.
        left: ${formatTime(left)}
      `);
    }
    return validated;
  }

  async updateLastLoginDate(userId: string | number): Promise<{ sameDay?: boolean; lastLoginAt?: Date }> {
    const user = await this.userRepository.findOne(userId);
    if (user) {
      const currentDate = new Date();
      if (user.lastLoginAt && differenceInCalendarDays(user.lastLoginAt, currentDate) < 1) {
        return { sameDay: true, lastLoginAt: user.lastLoginAt };
      }
      user.lastLoginAt = currentDate;
      await user.save();
      return { sameDay: false, lastLoginAt: currentDate };
    }
    return {};
  }

  public getUser(
    identifier: { email?: string; username?: string },
    isActive: boolean = true,
    options?: FindOneOptions<AbstractAuthUser>,
  ): Promise<AbstractAuthUser> {
    return this.userRepository.findOne(
      {
        ...(identifier.email ? { email: identifier.email } : null),
        ...(identifier.username ? { username: identifier.username } : null),
        isActive,
      } as any,
      options as any,
    );
  }

  public getUserWithPassword(
    identifier: { email?: string; username?: string },
    isActive: boolean = true,
  ): Promise<AbstractAuthUser> {
    return this.userRepository.findOne(
      {
        ...(identifier.email ? { email: identifier.email } : null),
        ...(identifier.username ? { username: identifier.username } : null),
        isActive,
      } as any,
      { select: ['id', 'username', 'email', 'password', 'salt'] },
    );
  }

  public updatePassword(id: number, password: string, salt: string): Promise<UpdateResult> {
    return this.userRepository.update(id, { password, salt } as any);
  }
}
