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

import { RestCrudController, SignException } from '../../base';
import { ResetPasswordDto, SignDto } from './auth.dto';
import { AdminAuthService } from './admin-auth.service';

const logger = new Logger('AdminAuthController');

@Controller('admin/auth')
export class AdminAuthController extends RestCrudController {
  constructor(private readonly adminAuthService: AdminAuthService) {
    super('auth');
  }

  // TODO need role: SYS_ADMIN
  @Post('reset-password')
  async resetPassword(@Body() resetPasswordDto: ResetPasswordDto) {
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
      throw new UnauthorizedException(`id '${user.id}' not exist.`);
    }
    return currentUser;
  }
}
