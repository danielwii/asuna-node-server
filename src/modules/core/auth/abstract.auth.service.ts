import { Logger } from '@nestjs/common';

import { AsunaErrorCode, AsunaException } from '@danielwii/asuna-helper/dist';
import { ConfigKeys } from '@danielwii/asuna-helper/dist/config';
import { resolveModule } from '@danielwii/asuna-helper/dist/logger/factory';
import { r } from '@danielwii/asuna-helper/dist/serializer';

import { oneLine } from 'common-tags';
import { addMonths, differenceInCalendarDays } from 'date-fns';
import * as jwt from 'jsonwebtoken';
import _ from 'lodash';
import { Cryptor } from 'node-buffs';
import ow from 'ow';
import { FindOneOptions, FindOptionsWhere, Repository } from 'typeorm';

import { formatTime, isBlank, TimeUnit } from '../../common/helpers';
import { configLoader } from '../../config';
import { named } from '../../helper/annotations';
import { OperationTokenHelper, SysTokenServiceName } from '../token';

import type { Secret, SignOptions } from 'jsonwebtoken';
import type { AuthUser, AuthUserChannel, AuthUserType } from './base.entities';
import type { JwtPayload } from './auth.interfaces';
import type { PrimaryKey } from '../../common';
import type { CreatedUser } from './auth.service';
import type { ConstrainedConstructor } from '@danielwii/asuna-helper/dist/interface';

export class PasswordHelper {
  private static readonly cryptor = new Cryptor();

  static encrypt(password: string): { hash: string; salt: string } {
    return this.cryptor.passwordEncrypt(password);
  }

  static passwordVerify(password: string, user: AuthUser): boolean {
    return this.cryptor.passwordCompare(password, user.password, user.salt);
  }
}

export interface CreatedToken {
  expiresIn: number;
  accessToken: string;
  refreshToken: string;
}

export class TokenHelper {
  private static logger = new Logger(resolveModule(__filename, 'TokenHelper'));

  static decode<Payload = JwtPayload>(token: string): Payload {
    const secretOrKey = configLoader.loadConfig(ConfigKeys.SECRET_KEY, 'secret');
    return jwt.verify(token, secretOrKey) as any;
  }

  static async createSessionToken(clientUser, extra?: { scid?: string }) {
    const expiresIn = TimeUnit.DAYS.toSeconds(1);
    const secretOrKey = configLoader.loadConfig(ConfigKeys.SECRET_KEY, 'secret');
    const payload: Omit<Partial<JwtPayload>, 'iat' | 'exp'> = { type: 'SessionToken', ...extra };
    this.logger.log(`sign payload ${r(payload)}`);
    const token = jwt.sign(payload, secretOrKey, { expiresIn });
    return { expiresIn, accessToken: token };
  }

  static async createToken(user: AuthUser, extra?: { sessionId?: string; uid?: string }): Promise<CreatedToken> {
    ow(user, 'user', ow.object.nonEmpty);

    const type = _.get(user, 'constructor.name');
    this.logger.log(`createToken >> ${r({ user, extra, type })}`);
    const expiresIn = TimeUnit.DAYS.toSeconds(30); // one month
    const secretOrKey = configLoader.loadConfig(ConfigKeys.SECRET_KEY, 'secret');
    const payload: Omit<JwtPayload, 'iat' | 'exp'> = {
      id: `${user.id}`,
      username: user.username,
      email: user.email,
      channel: user.channel,
      ...extra,
      type,
    };
    this.logger.log(`sign payload ${r(payload)}`);
    const accessToken = jwt.sign(payload, secretOrKey, { expiresIn });
    await OperationTokenHelper.deprecateToken({
      key: 'refresh-token',
      role: 'auth',
      service: SysTokenServiceName.User,
      identifier: user.id,
    });
    const refreshToken = await OperationTokenHelper.obtainToken({
      type: 'TimeBased',
      key: `refresh-token`,
      role: 'auth',
      service: SysTokenServiceName.User,
      identifier: user.id,
      expiredAt: addMonths(new Date(), 3),
    });
    return { expiresIn, accessToken, refreshToken: refreshToken.token };
  }

  static createCustomToken(
    payload: string | Buffer | object,
    secretOrPrivateKey: Secret,
    options?: SignOptions,
  ): string {
    this.logger.log(`createCustomToken >> ${r(payload)}`);
    return jwt.sign(payload, secretOrPrivateKey, options);
  }
}

export abstract class AbstractAuthService<U extends AuthUser> {
  private logger = new Logger(resolveModule(__filename, 'AbstractAuthService'));

  protected constructor(
    readonly AuthUserEntity: ConstrainedConstructor<U> & AuthUserType,
    readonly authUserRepository: Repository<U>,
  ) {}

  abstract createUser(
    username: string,
    email: string,
    password: string,
    channel?: AuthUserChannel,
    roleNames?: string[],
  ): Promise<CreatedUser<U>>;

  async validateUser(payload: JwtPayload): Promise<boolean> {
    const identifier = { email: payload.email, username: payload.username };
    const user = await this.getUser(identifier, true);

    const left = Math.floor(payload.exp - Date.now() / 1000);
    const validated = !_.isNil(user) && user.id === payload.id;
    if (!validated) {
      this.logger.debug(oneLine`
        validated(${validated}) >> identifier: ${r(identifier)} exists: ${!!user}.
        left: ${formatTime(left)}
      `);
    }
    return validated;
  }

  async createToken(authUser: U, extra?: { uid: string }): Promise<CreatedToken> {
    authUser.lastSignedAt = new Date();
    await authUser.save();
    return TokenHelper.createToken(authUser, extra);
  }

  @named
  async updateLastLoginDate(uid: PrimaryKey, funcName?: string): Promise<{ sameDay?: boolean; lastLoginAt?: Date }> {
    const authUser = await this.authUserRepository.findOneBy({ id: uid as any });
    if (authUser) {
      const currentDate = new Date();
      const calendarDays = differenceInCalendarDays(currentDate, authUser.lastLoginAt);
      this.logger.debug(`<${funcName}> ${r({ lastLoginAt: authUser.lastLoginAt, currentDate, diff: calendarDays })}`);
      if (authUser.lastLoginAt && calendarDays < 1) {
        return { sameDay: true, lastLoginAt: authUser.lastLoginAt };
      }
      authUser.lastLoginAt = currentDate;
      await authUser.save();
      return { sameDay: false, lastLoginAt: currentDate };
    }
    return {};
  }

  async getUser(
    identifier: { email?: string; username?: string },
    isActive?: boolean,
    options?: Exclude<FindOneOptions<U>, 'where'>,
  ): Promise<U> {
    const where = _.pickBy(
      { email: identifier.email, username: identifier.username, isActive },
      (v) => !_.isUndefined(v),
    ) as FindOptionsWhere<U>;
    this.logger.debug(`get user by where ${r(where)}`);
    if (isBlank(where.email) && isBlank(where.username)) {
      throw new AsunaException(AsunaErrorCode.BadRequest, `email or username must not both be empty`);
    }
    return this.authUserRepository.findOne({ where, ...options });
  }

  getUserWithPassword(identifier: { email?: string; username?: string }, isActive = true): Promise<U> {
    return this.authUserRepository.findOne({
      where: {
        // ...R.ifElse(R.identity, R.always({ email: identifier.email }), R.always({}))(!!identifier.email),
        ...(identifier.email ? { email: identifier.email } : {}),
        // ...R.ifElse(R.identity, R.always({ username: identifier.username }), R.always({}))(!!identifier.username),
        ...(identifier.username ? { username: identifier.username } : {}),
        isActive,
      } as any,
      select: ['id', 'username', 'email', 'channel', 'password', 'salt'],
    });
  }

  async updatePassword(uid: PrimaryKey, password: string, salt: string): Promise<void> {
    this.logger.log(`update password ${r({ uid, password, salt })}`);
    await this.authUserRepository.update(uid, { password, salt } as any);
    // return UserProfile.update(uid, { password, salt });
  }

  async updateAccount(uid: PrimaryKey, { username, email }: { username: string; email?: string }): Promise<U> {
    const authUser = await this.AuthUserEntity.findOneByOrFail<AuthUser>({ id: uid as any });
    if (username) authUser.username = username;
    if (email) authUser.email = email;
    // FIXME authUser.isBound = true;
    return (await authUser.save()) as U;
  }
}
