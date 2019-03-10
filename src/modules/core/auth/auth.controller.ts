import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Logger,
  Post,
  Req,
  UnauthorizedException,
} from '@nestjs/common';

import { RestCrudController } from '../../base/base.controllers';
import { SignException } from '../../base/base.exceptions';
import { ResetPasswordDto, SignDto } from './auth.dto';
import { AuthService } from './auth.service';

const logger = new Logger('AuthController');

@Controller('admin/auth')
export class AuthController extends RestCrudController {
  constructor(private readonly authService: AuthService) {
    super('auth');
  }

  // TODO need role: SYS_ADMIN
  @Post('reset-password')
  async resetPassword(@Body() resetPasswordDto: ResetPasswordDto) {
    logger.log(`reset password: ${JSON.stringify(resetPasswordDto)}`);
    const user = await this.authService.getUser(resetPasswordDto.email, true);

    if (!user) {
      throw new SignException('account not exists or active');
    }

    const { hash, salt } = this.authService.encrypt(resetPasswordDto.password);
    return this.authService.updatePassword(user.id, hash, salt);
  }

  @Post('token')
  @HttpCode(HttpStatus.OK)
  async getToken(@Body() signDto: SignDto) {
    logger.log(`getToken() >> ${signDto.email}`);
    const user = await this.authService.getUserWithPassword(signDto.email, true);

    if (!user) {
      throw new SignException('account not exists or active');
    }

    const isCorrect = this.authService.passwordVerify(signDto.password, user);

    if (!isCorrect) {
      throw new SignException('wrong password');
    }

    return await this.authService.createToken(user);
  }

  @Get('authorized')
  async authorized() {
    logger.log('Authorized route...');
  }

  @Get('current')
  async current(@Req() request) {
    const { user } = request;
    logger.log(`current... ${JSON.stringify(user)}`);
    const currentUser = await this.authService.getUser(user.email, true, { relations: ['roles'] });
    if (!currentUser) {
      throw new UnauthorizedException(`id '${user.id}' not exist.`);
    }
    return currentUser;
  }
}
