import { Body, Get, HttpCode, HttpStatus, Post, Req, UseGuards } from '@nestjs/common';
import * as Chance from 'chance';
import * as _ from 'lodash';
import { DeepPartial, UpdateResult } from 'typeorm';
import { AsunaErrorCode, AsunaException, AsunaExceptionHelper, AsunaExceptionTypes, LoggerFactory } from '../../common';
import { r } from '../../common/helpers';
import { Hermes } from '../bus';
import { DBHelper } from '../db';
import { CreatedToken, PasswordHelper } from './abstract.auth.service';
import { ResetAccountDto, ResetPasswordDto, SignInDto } from './auth.dto';
import { JwtAuthGuard, JwtAuthRequest } from './auth.guard';
import { AuthService } from './auth.service';
import { AuthUserChannel, WithProfileUser, WithProfileUserInstance } from './base.entities';

const logger = LoggerFactory.getLogger('AbstractAuthController');

export abstract class AbstractAuthController {
  constructor(
    private readonly UserEntity: WithProfileUser,
    private readonly authService: AuthService,
    private readonly handlers: {
      onResetPassword?: <Result>(result: Result, body) => Promise<Result>;
      onSignUp?: <Result>(result: Result, body) => Promise<void>;
    } = {},
  ) {}

  @Post('reset-password')
  @UseGuards(new JwtAuthGuard())
  async resetPassword(@Body() dto: ResetPasswordDto, @Req() req: JwtAuthRequest): Promise<UpdateResult> {
    const { payload, user } = req;
    logger.log(`reset password: ${r({ dto, payload, user })}`);

    const { hash, salt } = PasswordHelper.encrypt(dto.password);
    return this.authService
      .updatePassword(user.id, hash, salt)
      .then((result) => this.handlers.onResetPassword?.(result, dto));
  }

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
      .createUser<WithProfileUserInstance>(username, undefined, password, AuthUserChannel.quickpass)
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
    const token = await this.authService.createToken(profile, { uid: signed.user.id });
    return { username, defaultPassword: password, token };
  }

  @Post('sign-up')
  async signUp(@Body() body): Promise<WithProfileUserInstance> {
    logger.log(`sign-up: ${r(body)}`);
    const found = await this.authService.getUser(_.pick(body, ['email', 'username']), true);

    if (found) {
      throw AsunaExceptionHelper.genericException(AsunaExceptionTypes.ElementExists, [
        'user',
        r(_.pick(body, ['email', 'username']), { stringify: true }),
      ]);
    }

    return this.authService
      .createUser<WithProfileUserInstance>(_.get(body, 'username'), _.get(body, 'email'), _.get(body, 'password'))
      .then(async (result) => {
        if (this.handlers.onSignUp) {
          await this.handlers.onSignUp(result, body);
        }
        const user = await this.UserEntity.findOne(result.user.id, { relations: ['profile'] });
        return _.get(user, 'profile');
      });
  }

  @Post('token')
  @HttpCode(HttpStatus.OK)
  async getToken(@Body() signInDto: SignInDto): Promise<CreatedToken> {
    logger.log(`getToken() >> ${signInDto.username}`);
    const profile = await this.authService.getUserWithPassword({ username: signInDto.username });

    logger.verbose(`get user ${r(profile)}`);
    if (!profile || !profile?.password) {
      throw new AsunaException(AsunaErrorCode.InvalidCredentials, 'account not exists or active');
    }

    const verified = PasswordHelper.passwordVerify(signInDto.password, profile);

    if (!verified) {
      throw new AsunaException(AsunaErrorCode.InvalidCredentials, 'username or wrong password');
    }
    Hermes.emit('user.activity.event', 'login', { userId: profile.id });

    const user = await this.UserEntity.findOneOrFail({ where: { profileId: profile.id } });
    // return TokenHelper.createToken(profile, { uid: user.id });
    return this.authService.createToken(profile, { uid: user.id });
  }

  @Get('current')
  @UseGuards(new JwtAuthGuard())
  async current(@Req() req: JwtAuthRequest): Promise<DeepPartial<WithProfileUser>> {
    const { user, payload } = req;
    logger.log(`current... ${r({ user, payload })}`);
    const relations = DBHelper.getRelationPropertyNames(this.UserEntity);
    const loaded = await this.UserEntity.findOne<WithProfileUserInstance>(payload.uid, {
      // maybe get relations from a register
      relations: ['wallet', 'profile'].filter((relation) => relations.includes(relation)),
    });
    if (!payload) {
      throw new AsunaException(AsunaErrorCode.InvalidCredentials, `user '${user.username}' not active or exist.`);
    }
    this.authService
      .updateLastLoginDate(payload.id)
      .then(({ sameDay, lastLoginAt }) => {
        logger.verbose(`updateLastLoginDate ${r({ sameDay, lastLoginAt })}`);
        if (!sameDay) Hermes.emit(AbstractAuthController.name, 'user.first-login-everyday', payload);
        // !sameDay && Hermes.emit(AuthController.name, HermesUserEventKeys.firstLoginEveryday, payload);
      })
      .catch((reason) => logger.error(reason));
    logger.verbose(`current authed user is ${r(loaded)}`);
    const result = _.omit(loaded, 'channel', 'info'); // ...
    _.set(result, 'profile', _.pick(result.profile, 'id', 'email', 'portrait', 'isBound', 'channel'));
    return result;
  }

  @Get('authorized')
  @UseGuards(new JwtAuthGuard())
  async authorized(): Promise<void> {
    logger.log('Authorized route...');
  }
}
