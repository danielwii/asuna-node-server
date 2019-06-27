import * as otplib from 'otplib';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Logger,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import { UpdateResult } from 'typeorm';

import { ResetPasswordDto, SignDto } from './auth.dto';
import { AdminAuthService } from './admin-auth.service';
import { AsunaCode, AsunaException, RestCrudController, SignException } from '../base';
import { SysTokenServiceName, TokenHelper } from '../token';

const logger = new Logger('AdminAuthController');

@Controller('admin/auth')
export class AdminAuthController extends RestCrudController {
  constructor(private readonly adminAuthService: AdminAuthService) {
    super('auth');
  }

  @Post('otp')
  async otp(@Req() request, @Res() res) {
    const { user } = request;
    if (!user) {
      return res.status(HttpStatus.I_AM_A_TEAPOT).send();
    }
    logger.log(`generate [login] otp to ${JSON.stringify(user)}`);

    const tokenOptions = {
      role: 'admin',
      identifier: `admin-username=${user.username}`,
      service: SysTokenServiceName.AdminLogin,
    };
    await TokenHelper.deprecateOperationTokens(tokenOptions as any);
    const operationToken = await TokenHelper.acquireToken(tokenOptions as any);

    const otpauth = otplib.authenticator.keyuri(
      operationToken.identifier,
      operationToken.service,
      operationToken.shortId,
    );
    logger.log('otpauth is', otpauth);

    return res.status(HttpStatus.CREATED).send(otpauth);
  }

  // TODO need role: SYS_ADMIN
  @Post('reset-password')
  async resetPassword(@Body() resetPasswordDto: ResetPasswordDto): Promise<UpdateResult> {
    logger.log(`reset password: ${JSON.stringify(resetPasswordDto)}`);
    const user = await this.adminAuthService.getUser(resetPasswordDto.email, true);

    if (!user) {
      throw new SignException('account not exists or active');
    }

    const { hash, salt } = this.adminAuthService.encrypt(resetPasswordDto.password);
    return this.adminAuthService.updatePassword(user.id, hash, salt);
  }

  @Post('token')
  @HttpCode(HttpStatus.OK)
  async getToken(@Body() signDto: SignDto) {
    logger.log(`getToken() >> ${signDto.email}`);
    const user = await this.adminAuthService.getUserWithPassword(signDto.email, true);

    if (!user) {
      throw new SignException('account not exists or active');
    }

    const isCorrect = this.adminAuthService.passwordVerify(signDto.password, user);

    if (!isCorrect) {
      throw new SignException('wrong password');
    }

    return await this.adminAuthService.createToken(user);
  }

  @Get('authorized')
  async authorized() {
    logger.log('Authorized route...');
  }

  @Get('current')
  async current(@Req() request) {
    const { user } = request;
    logger.log(`current... ${JSON.stringify(user)}`);
    const currentUser = await this.adminAuthService.getUser(user.email, true, {
      relations: ['roles'],
    });
    if (!currentUser) {
      throw new AsunaException(AsunaCode.InsufficientPermissions, `id '${user.id}' not exist.`);
    }
    return currentUser;
  }
}
