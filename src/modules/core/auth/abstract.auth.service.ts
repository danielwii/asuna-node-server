import { oneLine } from 'common-tags';
import { differenceInCalendarDays } from 'date-fns';
import * as jwt from 'jsonwebtoken';
import * as _ from 'lodash';
import * as R from 'ramda';
import { Cryptor } from 'node-buffs';
import { FindOneOptions, Repository, UpdateResult } from 'typeorm';

import { formatTime, r, TimeUnit } from '../../common/helpers';
import { LoggerFactory } from '../../common/logger';
import { ConfigKeys, configLoader } from '../../config';

import type { Secret, SignOptions } from 'jsonwebtoken';
import type { AuthUser, AuthUserChannel, AuthUserType } from './base.entities';
import type { JwtPayload } from './auth.interfaces';
import type { PrimaryKey } from '../../common';
import type { FindConditions } from 'typeorm/find-options/FindConditions';
import type { Constructor } from '../../base';
import type { CreatedUser } from './auth.service';
import ow from 'ow';

const logger = LoggerFactory.getLogger('AbstractAuthService');

export class PasswordHelper {
  private static readonly cryptor = new Cryptor();

  public static encrypt(password: string): { hash: string; salt: string } {
    return this.cryptor.passwordEncrypt(password);
  }

  public static passwordVerify(password: string, user: AuthUser): boolean {
    return this.cryptor.passwordCompare(password, user.password, user.salt);
  }
}

export interface CreatedToken {
  expiresIn: number;
  accessToken: string;
}

export class TokenHelper {
  public static decode<Payload = JwtPayload>(token: string): Payload {
    const secretOrKey = configLoader.loadConfig(ConfigKeys.SECRET_KEY, 'secret');
    return jwt.verify(token, secretOrKey) as any;
  }

  public static async createSessionToken(clientUser, extra?: { sessionId?: string; uid?: string }) {
    const expiresIn = TimeUnit.DAYS.toSeconds(1);
    const secretOrKey = configLoader.loadConfig(ConfigKeys.SECRET_KEY, 'secret');
    const payload: Omit<Partial<JwtPayload>, 'iat' | 'exp'> = { type: 'SessionToken', ...extra };
    logger.log(`sign payload ${r(payload)}`);
    const token = jwt.sign(payload, secretOrKey, { expiresIn });
    return { expiresIn, accessToken: token };
  }

  public static async createToken(user: AuthUser, extra?: { sessionId?: string; uid?: string }): Promise<CreatedToken> {
    ow(user, 'user', ow.string.nonEmpty);

    const type = _.get(user, 'constructor.name');
    logger.log(`createToken >> ${r({ user, extra, type })}`);
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
    logger.log(`sign payload ${r(payload)}`);
    const token = jwt.sign(payload, secretOrKey, { expiresIn });
    return { expiresIn, accessToken: token };
  }

  public static createCustomToken(
    payload: string | Buffer | object,
    secretOrPrivateKey: Secret,
    options?: SignOptions,
  ): string {
    logger.log(`createCustomToken >> ${r(payload)}`);
    return jwt.sign(payload, secretOrPrivateKey, options);
  }
}

export abstract class AbstractAuthService<U extends AuthUser> {
  protected constructor(
    public readonly AuthUserEntity: Constructor<U> & AuthUserType,
    public readonly authUserRepository: Repository<U>,
  ) {}

  public abstract createUser(
    username: string,
    email: string,
    password: string,
    channel?: AuthUserChannel,
    roleNames?: string[],
  ): Promise<CreatedUser<U>>;

  public async validateUser(payload: JwtPayload): Promise<boolean> {
    const identifier = { email: payload.email, username: payload.username };
    const user = await this.getUser(identifier, true);

    const left = Math.floor(payload.exp - Date.now() / 1000);
    const validated = !_.isNil(user) && user.id === payload.id;
    if (!validated) {
      logger.debug(oneLine`
        validated(${validated}) >> identifier: ${r(identifier)} exists: ${!!user}.
        left: ${formatTime(left)}
      `);
    }
    return validated;
  }

  public async createToken(authUser: U, extra?: { uid: string }): Promise<CreatedToken> {
    authUser.lastSignedAt = new Date();
    await authUser.save();
    return TokenHelper.createToken(authUser, extra);
  }

  public async updateLastLoginDate(uid: PrimaryKey): Promise<{ sameDay?: boolean; lastLoginAt?: Date }> {
    const authUser = await this.authUserRepository.findOne(uid);
    if (authUser) {
      const currentDate = new Date();
      const calendarDays = differenceInCalendarDays(authUser.lastLoginAt, currentDate);
      if (authUser.lastLoginAt && calendarDays < 1) {
        return { sameDay: true, lastLoginAt: authUser.lastLoginAt };
      }
      authUser.lastLoginAt = currentDate;
      await authUser.save();
      return { sameDay: false, lastLoginAt: currentDate };
    }
    return {};
  }

  public async getUser(
    identifier: { email?: string; username?: string },
    isActive?: boolean,
    options?: FindOneOptions<U>,
  ): Promise<U> {
    const condition: FindConditions<U> = {
      ...R.ifElse(R.identity, R.always({ email: identifier.email }), R.always({}))(!!identifier.email),
      ...R.ifElse(R.identity, R.always({ username: identifier.username }), R.always({}))(!!identifier.username),
      ...R.ifElse(R.identity, R.always({ isActive }), R.always({}))(!_.isNil(isActive)),
    };
    logger.debug(`get user by condition ${r(condition)}`);
    return this.authUserRepository.findOne(condition, options);
  }

  public getUserWithPassword(identifier: { email?: string; username?: string }, isActive = true): Promise<U> {
    return this.authUserRepository.findOne(
      {
        ...R.ifElse(R.identity, R.always({ email: identifier.email }), R.always({}))(!!identifier.email),
        ...R.ifElse(R.identity, R.always({ username: identifier.username }), R.always({}))(!!identifier.username),
        isActive,
      },
      { select: ['id', 'username', 'email', 'channel', 'password', 'salt'] },
    );
  }

  public updatePassword(uid: PrimaryKey, password: string, salt: string): Promise<UpdateResult> {
    return this.authUserRepository.update(uid, { password, salt } as any);
    // return UserProfile.update(uid, { password, salt });
  }

  public async updateAccount(uid: PrimaryKey, { username, email }: { username: string; email?: string }): Promise<U> {
    const authUser = await this.AuthUserEntity.findOneOrFail<AuthUser>(uid);
    if (username) authUser.username = username;
    if (email) authUser.email = email;
    // FIXME authUser.isBound = true;
    return (await authUser.save()) as U;
  }
}
