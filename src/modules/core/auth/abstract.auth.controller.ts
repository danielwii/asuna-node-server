import { Body, Get, HttpCode, HttpStatus, Post, Req, UseGuards } from '@nestjs/common';

import {
  AsunaErrorCode,
  AsunaException,
  AsunaExceptionHelper,
  AsunaExceptionTypes,
} from '@danielwii/asuna-helper/dist/exceptions';
import { Hermes } from '@danielwii/asuna-helper/dist/hermes/hermes';
import { LoggerFactory } from '@danielwii/asuna-helper/dist/logger';
import { r } from '@danielwii/asuna-helper/dist/serializer';

import { Promise } from 'bluebird';
import Chance from 'chance';
import _ from 'lodash';
import { DeepPartial, UpdateResult } from 'typeorm';

import { DBHelper } from '../db';
import { AbstractAuthService, CreatedToken, PasswordHelper } from './abstract.auth.service';
import { ResetAccountDto, ResetPasswordDto, SignInDto } from './auth.dto';
import { JwtAuthGuard, JwtAuthRequest } from './auth.guard';
import { AuthUser, AuthUserChannel, AuthUserType, WithProfileUser } from './base.entities';
import { UserProfile } from './user.entities';

import type { ConstrainedConstructor } from '../../base';

const logger = LoggerFactory.getLogger('AbstractAuthController');

export abstract class AbstractAuthController<U extends AuthUser> {
  public constructor(
    public readonly UserEntity: ConstrainedConstructor<U> & AuthUserType,
    public readonly authService: AbstractAuthService<U>,
    public readonly handlers: {
      onResetPassword?: <Result>(result: Result, body) => Promise<Result>;
      onSignUp?: <Result>(result: Result, body) => Promise<void>;
    } = {},
  ) {}

  @HttpCode(200)
  @Post('reset-password')
  @UseGuards(JwtAuthGuard)
  async resetPassword(@Body() dto: ResetPasswordDto, @Req() req: JwtAuthRequest): Promise<UpdateResult> {
    const { payload } = req;
    logger.log(`reset password: ${r({ dto, payload })}`);

    const { hash, salt } = PasswordHelper.encrypt(dto.password);
    return this.authService
      .updatePassword(payload.id, hash, salt)
      .then((result) => this.handlers.onResetPassword?.(result, dto));
  }

  @HttpCode(200)
  @Post('reset-account')
  @UseGuards(JwtAuthGuard)
  async resetAccount(@Body() dto: ResetAccountDto, @Req() req: JwtAuthRequest): Promise<void> {
    const { payload, user } = req;
    logger.log(`reset account: ${r({ dto, payload, user })}`);

    if (user.isBound) {
      throw new AsunaException(AsunaErrorCode.Unprocessable, `account already reset.`);
    }

    const found = await this.authService.getUser({ email: dto.email, username: dto.username });
    if (found) {
      throw new AsunaException(AsunaErrorCode.Unprocessable, `username or email already exists`);
    }

    const profile = await this.authService.updateAccount(payload.id, dto);
    // profile.isBound = true;
    // await profile.save();

    const userEntity = await this.UserEntity.findOne(payload.uid);
    if (_.has(userEntity, 'username') && dto.username) _.set(userEntity, 'username', profile.username);
    if (_.has(userEntity, 'email') && dto.email) _.set(userEntity, 'email', profile.email);
    await userEntity.save();
  }

  @Post('quick-pass')
  async quickPass(@Body() body): Promise<{ username: string; defaultPassword: string; token: CreatedToken }> {
    const chance = new Chance();
    const username = chance.string({ length: 6, pool: '0123456789abcdefghjkmnpqrstuvwxyz' });
    const password = chance.string({ length: 6, pool: '0123456789' });

    // const email = `${username}@quick.passport`;
    const signed = await this.authService
      .createUser(username, undefined, password, AuthUserChannel.quickpass)
      .then(async (result) => {
        if (this.handlers.onSignUp) {
          await this.handlers.onSignUp(result, body);
        }
        return result;
      });
    /*
    signed.profile.channel = AuthUserChannel.quickpass;
    await signed.profile.save();
    if (_.has(signed.user, 'email')) signed.user.email = email;
    await signed.user.save();
*/
    const profile = await this.authService.getUserWithPassword({ username });
    const token = await this.authService.createToken(profile, { uid: `${signed.user.id}` });
    return { username, defaultPassword: password, token };
  }

  @Post('sign-up')
  async signUp(@Body() body) {
    logger.log(`sign-up: ${r(body)}`);
    const found = await this.authService.getUser(_.pick(body, ['email', 'username']), true);

    if (found) {
      throw AsunaExceptionHelper.genericException(AsunaExceptionTypes.AccountExists, [body.email, body.username]);
    }

    return this.authService
      .createUser(_.get(body, 'username'), _.get(body, 'email'), _.get(body, 'password'))
      .then(async (result) => {
        logger.log(`created user ${r(result)}`);
        if (this.handlers.onSignUp) {
          await this.handlers.onSignUp(result, body);
        }
        const relations = _.intersection(DBHelper.getColumnNames(this.UserEntity), ['profile']);
        return this.UserEntity.findOne(result.user.id, { relations });
        // return _.get(user, 'profile');
      });
  }

  @Post('token')
  @HttpCode(HttpStatus.OK)
  async getToken(@Body() signInDto: SignInDto): Promise<CreatedToken> {
    logger.log(`getToken() >> ${signInDto.username}`);
    const profile = await this.authService.getUserWithPassword({ username: signInDto.username });

    logger.debug(`get user profile from token ${r(profile)}`);
    if (!profile?.password) {
      throw AsunaExceptionHelper.genericException(AsunaExceptionTypes.InvalidAccount);
    }

    const verified = PasswordHelper.passwordVerify(signInDto.password, profile);

    if (!verified) {
      throw AsunaExceptionHelper.genericException(AsunaExceptionTypes.WrongPassword);
    }
    Hermes.emit('user.activity.event', 'login', { userId: profile.id });

    const columnNames = DBHelper.getColumnNames(this.UserEntity);
    const hasProfile = columnNames.includes('profile') || columnNames.includes('profile__id');
    const authUser = hasProfile
      ? await this.UserEntity.findOneOrFail<AuthUser>({ where: { profileId: profile.id } })
      : profile;
    // return TokenHelper.createToken(profile, { uid: user.id });
    logger.log(`getToken() ${r({ authUser, hasProfile, profile, columnNames })}`);
    return this.authService.createToken(profile, hasProfile ? { uid: `${authUser.id}` } : undefined);
  }

  @Get('current')
  @UseGuards(JwtAuthGuard)
  async current(@Req() req: JwtAuthRequest): Promise<DeepPartial<WithProfileUser>> {
    const { user, payload } = req;
    logger.log(`current... ${r({ user, payload })}`);
    if (!payload) {
      throw new AsunaException(AsunaErrorCode.InvalidCredentials, `user '${user?.username}' not active or exist.`);
    }
    // const relations = DBHelper.getRelationPropertyNames(this.UserEntity);
    /*
    const loaded = await this.UserEntity.findOne(payload.uid, {
      // maybe get relations from a register, cause user side relations won't load here.
      // relations: ['profile'],
    });
*/
    this.authService
      .updateLastLoginDate(payload.id)
      .then(({ sameDay, lastLoginAt }) => {
        logger.debug(`updateLastLoginDate ${r({ sameDay, lastLoginAt })}`);
        if (!sameDay) Hermes.emit(AbstractAuthController.name, 'user.first-login-everyday', payload);
        // !sameDay && Hermes.emit(AuthController.name, HermesUserEventKeys.firstLoginEveryday, payload);
      })
      .catch((reason) => logger.error(reason));
    // logger.debug(`current authed user is ${r(loaded)}`);
    const result = _.omit({ ...user }, 'channel', 'info'); // ...
    const relations = DBHelper.getRelationPropertyNames(this.UserEntity);
    logger.debug(`relations is ${r(relations)}`);
    if (relations.includes('profile')) {
      const profileId = _.get(result, 'profileId');
      const profile = await UserProfile.findOne(profileId, { relations: ['wallet'] });
      // const desensitized = _.omit(profile, 'salt', 'password', 'info');
      const { salt, password, ...desensitized } = profile;
      // logger.debug(`current profile is ${r({ profile, desensitized })}`);
      _.set(result, 'profile', desensitized);
    }
    return result;
  }

  @Get('authorized')
  @UseGuards(JwtAuthGuard)
  async authorized(): Promise<void> {
    logger.log('Authorized route...');
  }
}
