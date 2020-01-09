/* eslint-disable eslint-comments/disable-enable-pair */
/* eslint-disable class-methods-use-this */
/* eslint-disable import/no-cycle */
import { Body, Controller, Get, Post, Query, Req, UseGuards } from '@nestjs/common';
import { IsString } from 'class-validator';
import { Request } from 'express';
import { r } from '../common/helpers';
import { LoggerFactory } from '../common/logger';
import { UserProfile } from '../core/auth/user.entities';
import { WXAuthGuard, WXAuthRequest } from './wechat.auth';
import { WXMiniAppUserInfo } from "./wechat.entities";
import { UserInfo, WeChatHelper, WxTicketType } from './wechat.helper';
import { WxQrTicketInfo } from './interfaces';

class ValidationDto {
  // 随机字符串
  @IsString()
  echostr: string;
  // 随机数
  @IsString()
  nonce: string;
  // 微信加密签名
  @IsString()
  signature: string;
  // 时间戳
  @IsString()
  timestamp: string;
}

class Code2SessionDto {
  @IsString()
  code: string;
}

const logger = LoggerFactory.getLogger('WeChatController');

@Controller('api/v1/wx')
export class WeChatController {
  @Get()
  async wxValidation(@Query() query: ValidationDto): Promise<string> {
    return (await WeChatHelper.checkSignature(query)) ? query.echostr : 'mismatch';
  }

  @Post()
  async wx(@Query() query, @Body() body, @Req() req: Request): Promise<string> {
    logger.log(`post ${r({ query, body })}`);
    if (!(await WeChatHelper.checkSignature(query))) {
      return 'mismatch';
    }

    return WeChatHelper.handleEvent(await WeChatHelper.parseXmlToJson(req));
  }

  @Post('code2session')
  async code2Session(@Body() body: Code2SessionDto): Promise<string> {
    logger.log(`code2Session ${r({ body })}`);
    return WeChatHelper.code2Session(body.code);
  }

  @Post('ticket')
  async ticket(@Body('type') type: WxTicketType, @Body('value') value: string): Promise<WxQrTicketInfo> {
    logger.log(`ticket ${r({ type, value })}`);
    return WeChatHelper.getTicketByType(type, value);
  }

  @UseGuards(new WXAuthGuard())
  @Get('user-info')
  async userInfo(@Body() userInfo: UserInfo, @Req() req: WXAuthRequest<UserProfile>): Promise<WXMiniAppUserInfo> {
    const { user } = req;
    logger.log(`update user-info ${r(userInfo)} for ${user.username}`);
    return WXMiniAppUserInfo.findOne({ profile: { id: user.id } });
  }

  @UseGuards(new WXAuthGuard())
  @Post('user-info')
  async updateUserInfo(@Body() userInfo: UserInfo, @Req() req: WXAuthRequest<UserProfile>): Promise<void> {
    const { user } = req;
    logger.log(`update user-info ${r(userInfo)} for ${user.username}`);
    return WeChatHelper.updateUserProfile(user, userInfo);
  }
}
