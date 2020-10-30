import { oneLine } from 'common-tags';
import { differenceInCalendarDays } from 'date-fns';
import * as jwt from 'jsonwebtoken';
import { Secret, SignOptions } from 'jsonwebtoken';
import * as _ from 'lodash';
import * as R from 'ramda';
import { Cryptor } from 'node-buffs';
import { FindOneOptions, Repository, UpdateResult } from 'typeorm';
import { formatTime, r } from '../../common/helpers';
import { LoggerFactory } from '../../common/logger';
import { ConfigKeys, configLoader } from '../../config';
import { JwtPayload } from './auth.interfaces';
import { AuthUser } from './base.entities';
import { UserProfile } from './user.entities';

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

  public static async createToken(user: AuthUser, extra?: { uid: string }): Promise<CreatedToken> {
    logger.log(`createToken >> ${r(user)}`);
    const expiresIn = 60 * 60 * 24 * 30; // one month
    const secretOrKey = configLoader.loadConfig(ConfigKeys.SECRET_KEY, 'secret');
    const payload: Omit<JwtPayload, 'iat' | 'exp'> = {
      id: user.id as string,
      ...extra,
      username: user.username,
      email: user.email,
      channel: user.channel,
    };
    const token = jwt.sign(payload, secretOrKey, { expiresIn });
    return {
      expiresIn,
      accessToken: token,
    };
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
  // eslint-disable-next-line @typescript-eslint/no-parameter-properties
  protected constructor(protected readonly userRepository: Repository<U>) {}

  public async validateUser(jwtPayload: JwtPayload): Promise<boolean> {
    const identifier = { email: jwtPayload.email, username: jwtPayload.username };
    const user = await this.getUser(identifier, true);

    const left = Math.floor(jwtPayload.exp - Date.now() / 1000);
    const validated = !_.isNil(user) && user.id === jwtPayload.id;
    if (!validated) {
      logger.debug(oneLine`
        validated(${validated}) >> identifier: ${r(identifier)} exists: ${!!user}.
        left: ${formatTime(left)}
      `);
    }
    return validated;
  }

  public createToken(profile: UserProfile, extra?: { uid: string }): Promise<CreatedToken> {
    // eslint-disable-next-line no-param-reassign
    profile.lastSignedAt = new Date();
    profile.save().catch((reason) => logger.error(reason));
    return TokenHelper.createToken(profile, extra);
  }

  public async updateLastLoginDate(profileId: string | number): Promise<{ sameDay?: boolean; lastLoginAt?: Date }> {
    const profile = await this.userRepository.findOne(profileId);
    if (profile) {
      const currentDate = new Date();
      const calendarDays = differenceInCalendarDays(profile.lastLoginAt, currentDate);
      if (profile.lastLoginAt && calendarDays < 1) {
        return { sameDay: true, lastLoginAt: profile.lastLoginAt };
      }
      profile.lastLoginAt = currentDate;
      await profile.save();
      return { sameDay: false, lastLoginAt: currentDate };
    }
    return {};
  }

  public async getUser(
    identifier: { email?: string; username?: string },
    isActive?: boolean,
    options?: FindOneOptions<U>,
  ): Promise<U> {
    const condition = {
      ...R.ifElse(R.identity, R.always({ email: identifier.email }), R.always({}))(!!identifier.email),
      ...R.ifElse(R.identity, R.always({ username: identifier.username }), R.always({}))(!!identifier.username),
      ...R.ifElse(R.identity, R.always({ isActive }), R.always({}))(!_.isNil(isActive)),
    };
    logger.debug(`get user by condition ${r(condition)}`);
    return this.userRepository.findOne(condition as any, options);
  }

  public getUserWithPassword(identifier: { email?: string; username?: string }, isActive = true): Promise<U> {
    return this.userRepository.findOne(
      {
        ...R.ifElse(R.identity, R.always({ email: identifier.email }), R.always({}))(!!identifier.email),
        ...R.ifElse(R.identity, R.always({ username: identifier.username }), R.always({}))(!!identifier.username),
        isActive,
      },
      { select: ['id', 'username', 'email', 'channel', 'password', 'salt'] },
    );
  }

  public updatePassword(profileId: string, password: string, salt: string): Promise<UpdateResult> {
    return this.userRepository.update(profileId, { password, salt } as any);
    // return UserProfile.update(profileId, { password, salt });
  }
}
