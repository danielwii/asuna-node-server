import { Body, Controller, Get, HttpCode, HttpStatus, Post, Req, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AccessControl } from 'accesscontrol';
import * as _ from 'lodash';
import * as otplib from 'otplib';
import { UpdateResult } from 'typeorm';
import { AsunaErrorCode, AsunaException, AsunaExceptionHelper, AsunaExceptionTypes, r } from '../../common';
import { LoggerFactory } from '../../common/logger';
import { AnyAuthRequest } from '../../helper/interfaces';
import { RestCrudController } from '../../rest/base.controllers';
import { DeprecateTokenParams, ObtainTokenOpts, OperationTokenHelper, SysTokenServiceName } from '../token';
import { PasswordHelper, TokenHelper } from './abstract.auth.service';
import { AdminAuthService } from './admin-auth.service';
import { AdminResetPasswordDto, SignDto } from './auth.dto';
import { AdminUser } from './auth.entities';
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
    logger.log('otpauth is', otpauth);

    return res.status(HttpStatus.CREATED).send(otpauth);
  }

  // TODO need role: SYS_ADMIN
  // FIXME type ResetPasswordDto not recognise email
  @HttpCode(200)
  @Post('reset-password')
  async resetPassword(@Body() resetPasswordDto: AdminResetPasswordDto): Promise<UpdateResult> {
    // ow(resetPasswordDto.email, 'email', ow.string.nonEmpty);
    const data = _.omitBy({ username: resetPasswordDto.username, email: resetPasswordDto.email }, _.isNull);
    logger.log(`reset password: ${r({ resetPasswordDto, data })}`);
    const user = await this.adminAuthService.getUser(data);

    if (!user) {
      throw AsunaExceptionHelper.genericException(AsunaExceptionTypes.InvalidAccount);
    }

    const { hash, salt } = PasswordHelper.encrypt(resetPasswordDto.password);
    return this.adminAuthService.updatePassword(user.id, hash, salt);
  }

  @Post('token')
  @HttpCode(HttpStatus.OK)
  async getToken(@Body() signDto: SignDto): Promise<{ expiresIn: number; accessToken: string }> {
    logger.log(`getToken() >> ${r(_.omit(signDto, 'password'))}`);
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
    logger.log('Authorized route...');
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
    logger.log(`access control is ${r({ ac })}`);
    const permission1 = ac.can('user').createOwn('video');
    logger.log(permission1.granted); // —> true
    logger.log(permission1.attributes); // —> ['*'] (all attributes)

    const permission2 = ac.can('admin').updateAny('video');
    logger.log(permission2.granted); // —> true
    logger.log(permission2.attributes); // —> ['title']

    logger.log(`access control is ${r({ ac, permission1, permission2 })}`);
  }

  @Get('current')
  async current(@Req() req: AnyAuthRequest): Promise<AdminUser> {
    const { user } = req;
    logger.log(`current... ${r(user)}`);
    const currentUser = await this.adminAuthService.getUser(user, true, { relations: ['roles'] });
    if (!currentUser) {
      throw new AsunaException(AsunaErrorCode.InsufficientPermissions, `id '${user.id}' not exist.`);
    }
    logger.log(`current... ${r(currentUser)}`);
    return currentUser;
  }
}
