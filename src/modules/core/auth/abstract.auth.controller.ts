import {
  BadRequestException,
  Body,
  Get,
  HttpCode,
  HttpStatus,
  Logger,
  Post,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';

import {
  AsunaErrorCode,
  AsunaException,
  AsunaExceptionHelper,
  AsunaExceptionTypes,
} from '@danielwii/asuna-helper/dist/exceptions';
import { Hermes } from '@danielwii/asuna-helper/dist/hermes/hermes';
import { resolveModule } from '@danielwii/asuna-helper/dist/logger/factory';
import { r } from '@danielwii/asuna-helper/dist/serializer';
import { ApiResponse } from '@danielwii/asuna-shared/dist/vo';

import { fileURLToPath } from 'node:url';

import appleSignIn from 'apple-signin-auth';
import Chance from 'chance';
import { IsOptional, IsString, ValidationSchema, registerSchema, validate } from 'class-validator';
import _ from 'lodash';

import { TimeUnit, isNotBlank } from '../../common';
import { EmailHelper } from '../../email/email.helper';
import { named } from '../../helper/annotations';
import { DBHelper } from '../db';
import { OperationTokenHelper } from '../token';
import { AbstractAuthService, CreatedToken, PasswordHelper } from './abstract.auth.service';
import { AppleConfigure } from './apple.configure';
import { ResetAccountDTO, ResetPasswordDTO, SignInDTO, UpdateProfileDTO } from './auth.dto';
import { JwtAnonymousSupportAuthGuard, JwtAuthGuard, JwtAuthRequest } from './auth.guard';
import { AuthUser, AuthUserChannel, WithProfileUser } from './base.entities';
import { AppleUserProfile, UserProfile } from './user.entities';

import type { ConstrainedConstructor } from '@danielwii/asuna-helper/dist/interface';
import type { BaseEntity, DeepPartial } from 'typeorm';
import type { CreatedUser } from './auth.service';

const chance = new Chance();
export const UsernameValidationSchema: ValidationSchema = {
  name: 'usernameValidationSchema',
  properties: {
    username: [{ type: 'isAlphanumeric' }],
  },
};
registerSchema(UsernameValidationSchema);

class SignInWithAppleDTO {
  @IsString() code: string;
  @IsString() @IsOptional() profileId?: string;
  @IsOptional() givenName: string;
  @IsOptional() familyName: string;
  // @IsOptional() useBundleId: boolean;
  @IsOptional() email: string;
  // @IsOptional() identityToken: any;
  // @IsOptional() state: any;
}

export abstract class AbstractAuthController<U extends WithProfileUser | AuthUser> {
  private readonly superLogger = new Logger(resolveModule(fileURLToPath(import.meta.url), this.constructor.name));

  constructor(
    readonly UserEntity: ConstrainedConstructor<U> & typeof BaseEntity,
    readonly authService: AbstractAuthService<AuthUser>,
    readonly handlers: {
      onResetPassword?: <Result>(result: Result, body) => Promise<Result>;
      onSignUp?: (result: CreatedUser<U>, body) => Promise<void>;
      onCurrent?: (user: U) => Promise<U & Record<any, any>>;
    } = {},
  ) {}

  @HttpCode(HttpStatus.OK)
  @Post('reset-password')
  @UseGuards(JwtAuthGuard)
  async resetPassword(@Body() dto: ResetPasswordDTO, @Req() req: JwtAuthRequest): Promise<ApiResponse> {
    const { payload } = req;
    this.superLogger.log(`reset password: ${r({ dto, payload })}`);

    const { hash, salt } = PasswordHelper.encrypt(dto.password);
    await this.authService
      .updatePassword(payload.id, hash, salt)
      .then((result) => this.handlers.onResetPassword?.(result, dto));
    return ApiResponse.success();
  }

  @HttpCode(HttpStatus.OK)
  @Post('reset-account')
  @UseGuards(JwtAuthGuard)
  async resetAccount(@Body() dto: ResetAccountDTO, @Req() req: JwtAuthRequest): Promise<ApiResponse> {
    const { payload, user } = req;
    this.superLogger.log(`reset account: ${r({ dto, payload, user })}`);

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
  async updateProfile(@Body() dto: UpdateProfileDTO, @Req() req: JwtAuthRequest): Promise<void> {
    const { payload, user } = req;
    this.superLogger.log(`update profile: ${r({ dto, payload, user })}`);

    if (user.isBanned) {
      throw new AsunaException(AsunaErrorCode.Unprocessable, `account already reset.`);
    }

    const profile = await UserProfile.findOneBy({ id: payload.uid });
    dto.nickname && (profile.nickname = dto.nickname);
    dto.position && (profile.position = dto.position);
    await profile.save();
  }

  @Post('sign-in-with-apple')
  @UseGuards(JwtAnonymousSupportAuthGuard)
  @named
  async signInWithApple(
    @Body() dto: SignInWithAppleDTO,
    @Req() req: JwtAuthRequest,
    funcName?: string,
  ): Promise<CreatedToken | void> {
    const { payload } = req;
    const appleConfig = await AppleConfigure.load();
    this.superLogger.log(`#${funcName} ${r({ dto, payload, appleConfig: appleConfig })}`);
    if (!appleConfig.enable) {
      throw new AsunaException(AsunaErrorCode.Unprocessable, `apple sign in is disabled.`);
    }

    if (dto.profileId && dto.profileId !== payload.id) {
      throw new AsunaException(AsunaErrorCode.Unprocessable, `profileId not match`);
    }
    const clientID = appleConfig.clientID;
    const clientSecret = appleSignIn.getClientSecret({
      clientID, // Apple Client ID
      teamID: appleConfig.teamID, // Apple Developer Team ID.
      privateKey: appleConfig.privateKey, // private key associated with your client ID. -- Or provide a `privateKeyPath` property instead.
      keyIdentifier: appleConfig.keyIdentifier, // identifier of the private key.
      // OPTIONAL
      expAfter: TimeUnit.DAYS.toSeconds(30), // Unix time in seconds after which to expire the clientSecret JWT. Default is now+5 minutes.
    });
    this.superLogger.debug(`#${funcName} ${r({ clientID, redirectUri: appleConfig.redirectUri, clientSecret })}`);
    const token = await appleSignIn.getAuthorizationToken(dto.code, {
      clientID, // Apple Client ID
      redirectUri: appleConfig.redirectUri, // use the same value which you passed to authorisation URL.
      clientSecret,
    });
    if (_.has(token, 'error')) {
      throw new AsunaException(AsunaErrorCode.Unprocessable, _.get(token, 'error'));
    }

    this.superLogger.debug(`#${funcName} ${r({ token })}`);
    const verified = await appleSignIn.verifyIdToken(token.id_token, {
      // Optional Options for further verification - Full list can be found here https://github.com/auth0/node-jsonwebtoken#jwtverifytoken-secretorkey-options-callback
      audience: clientID, // client id - can also be an array
      // nonce: 'NONCE', // nonce // Check this note if coming from React Native AS RN automatically SHA256-hashes the nonce https://github.com/invertase/react-native-apple-authentication#nonce
      // If you want to handle expiration on your own, or if you want the expired tokens decoded
      ignoreExpiration: true, // default is false
    });
    this.superLogger.debug(`#${funcName} ${r({ verified })}`);
    let exists = await AppleUserProfile.findOne({ where: { id: verified.sub }, relations: ['profile'] });
    if (!exists) {
      // const profile = await UserProfile.findOneBy({ id: dto.profileId });
      exists = await AppleUserProfile.save({
        id: verified.sub,
        email: verified.email,
        isEmailVerified: _.isString(verified.email_verified)
          ? verified.email_verified === 'true'
          : verified.email_verified,
        isPrivateEmail: _.isString(verified.is_private_email)
          ? verified.is_private_email === 'true'
          : verified.is_private_email,
        profile: await UserProfile.findOneBy({ id: dto.profileId }),
      });
      this.superLogger.debug(`#${funcName} ${r({ appleProfile: exists })}`);
    }
    this.superLogger.debug(`#${funcName} ${r({ exists })}`);

    if (!exists.profileId && dto.profileId) {
      // 未绑定profileId时直接绑定即可
      exists.profileId = dto.profileId;
      // await exists.save();
      await AppleUserProfile.save(exists);
      // TODO
      this.superLogger.warn(`#${funcName} should return something`);
      return;
    } else if (!exists.profileId) {
      // 不存在profileId时创建一个并绑定
      const username = chance.string({ length: 12, pool: '0123456789abcdefghjkmnpqrstuvwxyz' });
      this.superLogger.debug(`#${funcName} ${r({ username })}`);
      const signed = await this.authService.createUser(username, null, null, AuthUserChannel.apple);
      this.superLogger.debug(`#${funcName} ${r({ signed })}`);
      const profile = await this.authService.getUserWithPassword({ username });
      if (dto.givenName && !profile.nickname) {
        profile.nickname = `${dto.givenName} ${dto.familyName ?? ''}`.trim();
        await profile.save();
      }
      this.superLogger.debug(`#${funcName} ${r({ profile })}`);
      exists.profileId = profile.id;
      // await exists.save();
      await AppleUserProfile.save(exists);
      return await this.authService.createToken(profile, { uid: `${signed.user.id}` });
    } else {
      // 存在profile时直接创建一个token返回
      return await this.authService.createToken(exists.profile);
    }
  }

  /*
  @Get('apple/refresh')
  @named
  async appleRefreshToken(@Query() query, funcName?: string) {
    this.superLogger.log(`#${funcName} ${r(query)}`);
    return await appleSignIn.verifyIdToken(query.id_token, {
      // Optional Options for further verification - Full list can be found here https://github.com/auth0/node-jsonwebtoken#jwtverifytoken-secretorkey-options-callback
      audience: 'io.github.danielwii.****', // client id - can also be an array
      // nonce: 'NONCE', // nonce // Check this note if coming from React Native AS RN automatically SHA256-hashes the nonce https://github.com/invertase/react-native-apple-authentication#nonce
      // If you want to handle expiration on your own, or if you want the expired tokens decoded
      ignoreExpiration: true, // default is false
    });
  }

  @Get('apple-callback')
  @named
  async appleCallback(@Query() query, funcName?: string) {
    this.superLogger.log(`#${funcName} ${r(query)}`);
  } */

  @Post('quick-pass')
  async quickPass(@Body() body): Promise<{ username: string; defaultPassword: string; token: CreatedToken }> {
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

  /**
   * send verification code to email address
   * @param body
   * @param funcName
   */
  @Post('verify')
  @named
  async verify(@Body() body: { email?: string }, funcName?: string): Promise<ApiResponse> {
    this.superLogger.log(`#${funcName} ${r(body)}`);
    const email = body.email;
    if (!email) throw new BadRequestException('email is required');
    // 检测是否已存在该用户，不存在的话添加一个
    let user = await this.authService.getUserByEmail(email);
    this.superLogger.log(`#${funcName} found user ${r(user)}`);
    if (!user) {
      this.superLogger.log(`user ${r(body)} not exists, create one...`);
      const username = chance.string({ length: 18, pool: '0123456789abcdefghjkmnpqrstuvwxyz' });
      const created = await this.authService.createUser(username, email, null, AuthUserChannel.code);
      this.superLogger.log(`#${funcName} created user ${r(created)}`);
      user = created.user;
    }
    /*
    const user = await this.authService.getUserByEmail(email);
    if (!user) throw new NotFoundException('user not found'); */
    const code = chance.string({ length: 6, pool: '0123456789' });
    // const result = await this.emailService.sendEmail({
    await EmailHelper.send({
      to: [email],
      subject: 'Verify your email',
      // text: `Your verification code is ${code}`,
      content: `Your verification code is ${code}`,
    });
    await this.authService.setVerifyCode(user.id, code);
    return ApiResponse.success();
  }

  @Post('sign-up')
  async signUp(@Body() body) {
    this.superLogger.log(`sign-up: ${r(body)}`);
    const errors = await validate('usernameValidationSchema', { username: body.username });
    if (errors.length) {
      this.superLogger.warn(`validate body error ${r(errors)}`);
      throw new AsunaException(AsunaErrorCode.Unprocessable, '用户名格式不正确，只能包含英文和数字');
    }
    const found = await this.authService.getUser(_.pick(body, ['email', 'username']), true);

    if (found) {
      throw AsunaExceptionHelper.genericException(AsunaExceptionTypes.AccountExists, [body.email, body.username]);
    }

    this.superLogger.log('exists user not found, create one...');
    return this.authService
      .createUser(_.get(body, 'username'), _.get(body, 'email'), _.get(body, 'password'))
      .then(async (result) => {
        this.superLogger.log(`created user ${r(result)}`);
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

  // refresh access token by refresh token
  @UseGuards(JwtAuthGuard)
  @Post('refresh-token')
  @named
  async refreshToken(
    @Body('refreshToken') refreshToken: string,
    @Req() req: JwtAuthRequest,
    funcName?: string,
  ): Promise<CreatedToken> {
    const available = await OperationTokenHelper.checkAvailableByToken(refreshToken);
    this.superLogger.log(`#${funcName} token is available: ${r({ refreshToken, available })}`);
    if (!available) {
      throw new AsunaException(AsunaErrorCode.InvalidToken, 'refresh token not invalid');
    }
    return this.authService.createToken(req.profile, { uid: `${req.user.id}` });
  }

  @Post('token')
  @HttpCode(HttpStatus.OK)
  async getToken(@Body() dto: SignInDTO): Promise<CreatedToken> {
    this.superLogger.log(`getToken() >> ${dto.username}`);
    const profile = await this.authService.getUserWithPassword({ username: dto.username });

    this.superLogger.debug(`get user profile from token ${r(profile)}`);
    if (!profile?.password) {
      throw AsunaExceptionHelper.genericException(AsunaExceptionTypes.InvalidAccount);
    }

    const verified = PasswordHelper.passwordVerify(dto.password, profile);

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
    this.superLogger.log(`getToken() ${r({ authUser, hasProfile, profile, columnNames })}`);
    return this.authService.createToken(profile, hasProfile ? { uid: `${authUser.id}` } : undefined);
  }

  @Get('current')
  @UseGuards(JwtAuthGuard)
  async current(@Req() req: JwtAuthRequest): Promise<DeepPartial<WithProfileUser>> {
    const { user, payload } = req;
    this.superLogger.log(`current... ${r({ user, payload })}`);
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
        this.superLogger.debug(`updateLastLoginDate ${r({ sameDay, lastLoginAt })}`);
        if (!sameDay) Hermes.emit(AbstractAuthController.name, 'user.first-login-everyday', payload);
        // !sameDay && Hermes.emit(AuthController.name, HermesUserEventKeys.firstLoginEveryday, payload);
      })
      .catch((reason) => this.superLogger.error(reason));
    // this.superLogger.debug(`current authed user is ${r(loaded)}`);
    const result = _.omit({ ...user }, 'channel', 'info'); // ...
    const relations = DBHelper.getRelationPropertyNames(this.UserEntity);
    this.superLogger.debug(`relations is ${r(relations)}`);
    if (relations.includes('profile')) {
      const profileId = _.get(result, 'profileId');
      const profile = await UserProfile.findOne({ where: { id: profileId }, relations: ['wallet'] });
      // const desensitized = _.omit(profile, 'salt', 'password', 'info');
      const { salt, password, ...desensitized } = profile;
      // this.superLogger.debug(`current profile is ${r({ profile, desensitized })}`);
      _.set(result, 'profile', desensitized);
    }
    result.profile.isBindApple = await AppleUserProfile.findOneBy({ profileId: payload.id }).then((o) => !!o);
    return this.handlers.onCurrent ? await this.handlers.onCurrent(result) : result;
  }

  @Get('authorized')
  @UseGuards(JwtAuthGuard)
  async authorized(): Promise<void> {
    this.superLogger.log('Authorized route...');
  }
}
