// eslint-disable-next-line eslint-comments/disable-enable-pair
/* eslint-disable class-methods-use-this */
import { Body, Controller, Get, HttpCode, HttpStatus, Post, Req, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import * as otplib from 'otplib';
import { UpdateResult } from 'typeorm';
import { AsunaError, AsunaException, r, SignException } from '../../common';
import { LoggerFactory } from '../../common/logger';
import { RestCrudController } from '../base/base.controllers';
import { DeprecateTokenParams, ObtainTokenOpts, OperationTokenHelper, SysTokenServiceName } from '../token';
import { AdminAuthService } from './admin-auth.service';
import { SignDto } from './auth.dto';
import { AbstractAuthUser } from './base.entities';
import { AnyAuthRequest } from './helper';
import { AdminUserIdentifierHelper } from './identifier';

const logger = LoggerFactory.getLogger('AdminAuthController');

@ApiTags('sys-admin')
@Controller('admin/auth')
export class AdminAuthController extends RestCrudController {
  constructor(private readonly adminAuthService: AdminAuthService) {
    super('auth');
  }

  @Post('otp')
  async otp(@Req() request, @Res() res): Promise<void> {
    const { user } = request;
    if (!user) {
      return res.status(HttpStatus.I_AM_A_TEAPOT).send();
    }
    logger.log(`generate [login] otp to ${r(user)}`);

    const tokenOptions: ObtainTokenOpts | DeprecateTokenParams = {
      key: `otp:${user.id}`,
      type: 'Unlimited',
      role: 'auth',
      identifier: new AdminUserIdentifierHelper().stringify(user),
      service: SysTokenServiceName.AdminLogin,
    };
    await OperationTokenHelper.deprecateToken(tokenOptions);
    const operationToken = await OperationTokenHelper.obtainToken(tokenOptions);

    const otpauth = otplib.authenticator.keyuri(
      operationToken.identifier,
      operationToken.service,
      operationToken.shortId,
    );
    logger.log('otpauth is', otpauth);

    return res.status(HttpStatus.CREATED).send(otpauth);
  }

  // TODO need role: SYS_ADMIN
  // FIXME type ResetPasswordDto not recognise email
  @Post('reset-password')
  async resetPassword(@Body() resetPasswordDto): Promise<UpdateResult> {
    logger.log(`reset password: ${r(resetPasswordDto)}`);
    const user = await this.adminAuthService.getUser({ email: resetPasswordDto.email }, true);

    if (!user) {
      throw new SignException('account not exists or active');
    }

    const { hash, salt } = this.adminAuthService.encrypt(resetPasswordDto.password);
    return this.adminAuthService.updatePassword(user.id, hash, salt);
  }

  @Post('token')
  @HttpCode(HttpStatus.OK)
  async getToken(@Body() signDto: SignDto): Promise<{ expiresIn: number; accessToken: string }> {
    logger.log(`getToken() >> ${signDto.email}`);
    const user = await this.adminAuthService.getUserWithPassword({ email: signDto.email }, true);

    if (!user) {
      throw new SignException('account not exists or active');
    }

    const isCorrect = this.adminAuthService.passwordVerify(signDto.password, user);

    if (!isCorrect) {
      throw new SignException('wrong password');
    }

    return this.adminAuthService.createToken(user);
  }

  @Get('authorized')
  authorized(): void {
    logger.log('Authorized route...');
  }

  @Get('current')
  async current(@Req() req: AnyAuthRequest): Promise<AbstractAuthUser> {
    const { user } = req;
    logger.log(`current... ${r(user)}`);
    const currentUser = await this.adminAuthService.getUser(user, true, {
      relations: ['roles'],
    });
    if (!currentUser) {
      throw new AsunaException(AsunaError.InsufficientPermissions, `id '${user.id}' not exist.`);
    }
    logger.log(`current... ${r(currentUser)}`);
    return currentUser;
  }
}
