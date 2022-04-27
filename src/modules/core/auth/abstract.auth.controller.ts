import { Body, Get, HttpCode, HttpStatus, Post, Put, Req, UseGuards } from '@nestjs/common';

import {
  AsunaErrorCode,
  AsunaException,
  AsunaExceptionHelper,
  AsunaExceptionTypes,
} from '@danielwii/asuna-helper/dist/exceptions';
import { Hermes } from '@danielwii/asuna-helper/dist/hermes/hermes';
import { LoggerFactory } from '@danielwii/asuna-helper/dist/logger/factory';
import { r } from '@danielwii/asuna-helper/dist/serializer';
import { ApiResponse } from '@danielwii/asuna-shared/dist/vo';

import { Promise } from 'bluebird';
import Chance from 'chance';
import { registerSchema, validate, ValidationSchema } from 'class-validator';
import _ from 'lodash';
import { BaseEntity } from 'typeorm';
import { FindOptionsWhere } from 'typeorm/find-options/FindOptionsWhere';

import { isNotBlank } from '../../common';
import { DBHelper } from '../db';
import { AbstractAuthService, CreatedToken, PasswordHelper } from './abstract.auth.service';
import { ResetAccountDto, ResetPasswordDto, SignInDto, UpdateProfileDto } from './auth.dto';
import { JwtAuthGuard, JwtAuthRequest } from './auth.guard';
import { AuthUser, AuthUserChannel, WithProfileUser } from './base.entities';
import { UserProfile } from './user.entities';

import type { DeepPartial } from 'typeorm';
import type { CreatedUser } from './auth.service';
import type { ConstrainedConstructor } from '@danielwii/asuna-helper';

const logger = LoggerFactory.getLogger('AbstractAuthController');

export const UsernameValidationSchema: ValidationSchema = {
  name: 'usernameValidationSchema',
  properties: {
    username: [{ type: 'isAlphanumeric' }],
  },
};
registerSchema(UsernameValidationSchema);

export abstract class AbstractAuthController<U extends WithProfileUser | AuthUser> {
  public constructor(
    public readonly UserEntity: ConstrainedConstructor<U> & typeof BaseEntity,
    public readonly authService: AbstractAuthService<AuthUser>,
    public readonly handlers: {
      onResetPassword?: <Result>(result: Result, body) => Promise<Result>;
      onSignUp?: (result: CreatedUser<U>, body) => Promise<void>;
      onCurrent?: (user: U) => Promise<U & Record<any, any>>;
    } = {},
  ) {}

  @HttpCode(200)
  @Post('reset-password')
  @UseGuards(JwtAuthGuard)
  public async resetPassword(@Body() dto: ResetPasswordDto, @Req() req: JwtAuthRequest): Promise<ApiResponse> {
    const { payload } = req;
    logger.log(`reset password: ${r({ dto, payload })}`);

    const { hash, salt } = PasswordHelper.encrypt(dto.password);
    await this.authService
      .updatePassword(payload.id, hash, salt)
      .then((result) => this.handlers.onResetPassword?.(result, dto));
    return ApiResponse.success();
  }

  @HttpCode(200)
  @Post('reset-account')
  @UseGuards(JwtAuthGuard)
  public async resetAccount(@Body() dto: ResetAccountDto, @Req() req: JwtAuthRequest): Promise<ApiResponse> {
    const { payload, user } = req;
    logger.log(`reset account: ${r({ dto, payload, user })}`);

    if (user.isBanned) {
      throw new AsunaException(AsunaErrorCode.Unprocessable, `account already reset.`);
    }

    const found = await this.authService.getUser({ email: dto.email, username: dto.username });
    if (found) {
      throw new AsunaException(AsunaErrorCode.Unprocessable, `username or email already exists`);
    }

    const profile = await this.authService.updateAccount(payload.id, dto);
    // profile.isBound = true;
    // await profile.save();

    const userEntity = await this.UserEntity.findOneById(payload.uid);
    if (_.has(userEntity, 'username') && dto.username) _.set(userEntity, 'username', profile.username);
    if (_.has(userEntity, 'email') && dto.email) _.set(userEntity, 'email', profile.email);
    await userEntity.save();
    return ApiResponse.success();
  }

  @Put('profile')
  @UseGuards(JwtAuthGuard)
  public async updateNickname(@Body() dto: UpdateProfileDto, @Req() req: JwtAuthRequest): Promise<void> {
    const { payload, user } = req;
    logger.log(`update profile: ${r({ dto, payload, user })}`);

    if (user.isBanned) {
      throw new AsunaException(AsunaErrorCode.Unprocessable, `account already reset.`);
    }

    const profile = await UserProfile.findOneBy({ id: payload.uid });
    profile.nickname = dto.nickname;
    await profile.save();
  }

  @Post('quick-pass')
  public async quickPass(@Body() body): Promise<{ username: string; defaultPassword: string; token: CreatedToken }> {
    const chance = new Chance();
    const username = chance.string({ length: 6, pool: '0123456789abcdefghjkmnpqrstuvwxyz' });
    const password = chance.string({ length: 6, pool: '0123456789' });

    // const email = `${username}@quick.passport`;
    const signed = await this.authService
      .createUser(username, undefined, password, AuthUserChannel.quickpass)
      .then(async (result) => {
        if (this.handlers.onSignUp) {
          await this.handlers.onSignUp(result as any, body);
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
  public async signUp(@Body() body) {
    logger.log(`sign-up: ${r(body)}`);
    const errors = await validate('usernameValidationSchema', { username: body.username });
    if (errors.length) {
      logger.warn(`validate body error ${r(errors)}`);
      throw new AsunaException(AsunaErrorCode.Unprocessable, '用户名格式不正确，只能包含英文和数字');
    }
    const found = await this.authService.getUser(_.pick(body, ['email', 'username']), true);

    if (found) {
      throw AsunaExceptionHelper.genericException(AsunaExceptionTypes.AccountExists, [body.email, body.username]);
    }

    return this.authService
      .createUser(_.get(body, 'username'), _.get(body, 'email'), _.get(body, 'password'))
      .then(async (result) => {
        logger.log(`created user ${r(result)}`);
        if (isNotBlank(body.nickname)) {
          await UserProfile.update(result.profile.id, { nickname: body.nickname });
        }
        if (this.handlers.onSignUp) {
          await this.handlers.onSignUp(result as any, body);
        }
        const relations = _.intersection(DBHelper.getColumnNames(this.UserEntity), ['profile']);
        return this.UserEntity.findOne({ where: { id: result.user.id } as any, relations });
        // return _.get(user, 'profile');
      });
  }

  @Post('token')
  @HttpCode(HttpStatus.OK)
  public async getToken(@Body() signInDto: SignInDto): Promise<CreatedToken> {
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
      ? await this.UserEntity.findOneOrFail({ where: { profileId: profile.id } as any })
      : profile;
    // return TokenHelper.createToken(profile, { uid: user.id });
    logger.log(`getToken() ${r({ authUser, hasProfile, profile, columnNames })}`);
    return this.authService.createToken(profile, hasProfile ? { uid: `${authUser.id}` } : undefined);
  }

  @Get('current')
  @UseGuards(JwtAuthGuard)
  public async current(@Req() req: JwtAuthRequest): Promise<DeepPartial<WithProfileUser>> {
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
      const profile = await UserProfile.findOne({
        where: { id: profileId } as FindOptionsWhere<UserProfile>,
        relations: ['wallet'],
      });
      // const desensitized = _.omit(profile, 'salt', 'password', 'info');
      const { salt, password, ...desensitized } = profile;
      // logger.debug(`current profile is ${r({ profile, desensitized })}`);
      _.set(result, 'profile', desensitized);
    }
    return this.handlers.onCurrent ? await this.handlers.onCurrent(result) : result;
  }

  @Get('authorized')
  @UseGuards(JwtAuthGuard)
  public async authorized(): Promise<void> {
    logger.log('Authorized route...');
  }
}
