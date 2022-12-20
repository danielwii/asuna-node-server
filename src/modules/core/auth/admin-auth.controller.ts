import { Body, Controller, Get, HttpCode, HttpStatus, Logger, Post, Req, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

import {
  AsunaErrorCode,
  AsunaException,
  AsunaExceptionHelper,
  AsunaExceptionTypes,
} from '@danielwii/asuna-helper/dist/exceptions';
import { resolveModule } from '@danielwii/asuna-helper/dist/logger/factory';
import { r } from '@danielwii/asuna-helper/dist/serializer';
import { ApiResponse } from '@danielwii/asuna-shared/dist/vo';

import { AccessControl } from 'accesscontrol';
import _ from 'lodash';
import * as otplib from 'otplib';
import { fileURLToPath } from 'node:url';

import { RestCrudController } from '../../rest/base.controllers';
import { DeprecateTokenParams, ObtainTokenOpts, OperationTokenHelper, SysTokenServiceName } from '../token';
import { PasswordHelper, TokenHelper } from './abstract.auth.service';
import { AdminAuthService } from './admin-auth.service';
import { AdminUserIdentifierHelper } from './identifier';

import type { AdminResetPasswordDTO, SignDTO } from './auth.dto';
import type { AdminUser } from './auth.entities';
import type { AnyAuthRequest } from '../../helper/interfaces';

@ApiTags('sys-admin')
@Controller('admin/auth')
export class AdminAuthController extends RestCrudController {
  private readonly logger = new Logger(resolveModule(fileURLToPath(import.meta.url), AdminAuthController.name));

  constructor(private readonly adminAuthService: AdminAuthService) {
    super('auth');
  }

  @Post('otp')
  async otp(@Req() request, @Res() res): Promise<void> {
    const { user } = request;
    if (!user) {
      return res.status(HttpStatus.I_AM_A_TEAPOT).send();
    }
    this.logger.log(`generate [login] otp to ${r(user)}`);

    const tokenOptions: ObtainTokenOpts | DeprecateTokenParams = {
      key: `otp:${user.id}`,
      type: 'Unlimited',
      role: 'auth',
      identifier: AdminUserIdentifierHelper.stringify(user),
      service: SysTokenServiceName.AdminLogin,
    };
    await OperationTokenHelper.deprecateToken(tokenOptions);
    const operationToken = await OperationTokenHelper.obtainToken(tokenOptions);

    const otpauth = otplib.authenticator.keyuri(
      operationToken.identifier,
      operationToken.service,
      operationToken.shortId,
    );
    this.logger.log('otpauth is', otpauth);

    return res.status(HttpStatus.CREATED).send(otpauth);
  }

  // TODO need role: SYS_ADMIN
  // FIXME type ResetPasswordDto not recognise email
  @HttpCode(200)
  @Post('reset-password')
  async resetPassword(@Body() resetPasswordDto: AdminResetPasswordDTO): Promise<ApiResponse> {
    // ow(resetPasswordDto.email, 'email', ow.string.nonEmpty);
    const data = _.omitBy({ username: resetPasswordDto.username, email: resetPasswordDto.email }, _.isNull);
    this.logger.log(`reset password: ${r({ resetPasswordDto, data })}`);
    const user = await this.adminAuthService.getUser(data);

    if (!user) {
      throw AsunaExceptionHelper.genericException(AsunaExceptionTypes.InvalidAccount);
    }

    const { hash, salt } = PasswordHelper.encrypt(resetPasswordDto.password);
    await this.adminAuthService.updatePassword(user.id, hash, salt);
    return ApiResponse.success();
  }

  @Post('token')
  @HttpCode(HttpStatus.OK)
  async getToken(@Body() signDto: SignDTO): Promise<{ expiresIn: number; accessToken: string }> {
    this.logger.log(`getToken() >> ${r(_.omit(signDto, 'password'))}`);
    const user = await this.adminAuthService.getUserWithPassword(
      _.omitBy({ email: signDto.email, username: signDto.username }, _.isNil),
      true,
    );

    if (!user) {
      throw AsunaExceptionHelper.genericException(AsunaExceptionTypes.InvalidAccount);
    }

    const isCorrect = PasswordHelper.passwordVerify(signDto.password, user);

    if (!isCorrect) {
      throw AsunaExceptionHelper.genericException(AsunaExceptionTypes.WrongPassword, []);
    }

    return TokenHelper.createToken(user);
  }

  @Get('authorized')
  authorized(): void {
    this.logger.log('Authorized route...');
    const ac = new AccessControl();
    // prettier-ignore
    ac.grant('user') // define new or modify existing role. also takes an array.
        .createOwn('video') // equivalent to .createOwn('video', ['*'])
        .deleteOwn('video')
        .readAny('video')
      .grant('admin') // switch to another role without breaking the chain
        .extend('user') // inherit role capabilities. also takes an array
        .updateAny('video', ['title']) // explicitly defined attributes
        .deleteAny('video');
    this.logger.log(`access control is ${r({ ac })}`);
    const permission1 = ac.can('user').createOwn('video');
    this.logger.log(permission1.granted); // —> true
    this.logger.log(permission1.attributes); // —> ['*'] (all attributes)

    const permission2 = ac.can('admin').updateAny('video');
    this.logger.log(permission2.granted); // —> true
    this.logger.log(permission2.attributes); // —> ['title']

    this.logger.log(`access control is ${r({ ac, permission1, permission2 })}`);
  }

  @Get('current')
  async current(@Req() req: AnyAuthRequest): Promise<AdminUser> {
    const { user } = req;
    this.logger.log(`current... ${r(user)}`);
    const currentUser = await this.adminAuthService.getUser(user, true, { relations: ['roles'] });
    if (!currentUser) {
      throw new AsunaException(AsunaErrorCode.InsufficientPermissions, `id '${user.id}' not exist.`);
    }
    this.logger.log(`current... ${r(currentUser)}`);
    return currentUser;
  }
}
