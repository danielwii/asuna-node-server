import { Body, Controller, Get, Logger, Post, Query, Req, UseGuards } from '@nestjs/common';

import { resolveModule } from '@danielwii/asuna-helper/dist/logger/factory';
import { r } from '@danielwii/asuna-helper/dist/serializer';

import { IsString } from 'class-validator';

import { WXAuthGuard } from './wechat.auth';
import { WXMiniAppUserInfo } from './wechat.entities';
import { UserInfo, WeChatHelper, WxTicketType } from './wechat.helper';

import type { Request } from 'express';
import type { WXAuthRequest } from './wechat.interfaces';
import type { WxQrTicketInfo } from './wx.interfaces';
import { fileURLToPath } from "url";

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

@Controller('api/v1/wx')
export class WeChatController {
  private readonly logger = new Logger(resolveModule(fileURLToPath(import.meta.url), this.constructor.name));

  @Get()
  async wxValidation(@Query() query: ValidationDto): Promise<string> {
    return (await WeChatHelper.checkSignature(query)) ? query.echostr : 'mismatch';
  }

  @Post()
  async wx(@Query() query, @Body() body, @Req() req: Request): Promise<string> {
    this.logger.log(`post ${r({ query, body })}`);
    if (!(await WeChatHelper.checkSignature(query))) {
      return 'mismatch';
    }

    return WeChatHelper.handleEvent(await WeChatHelper.parseXmlToJson(req));
  }

  @Post('code2session')
  async code2Session(@Body() body: Code2SessionDto): Promise<string> {
    this.logger.log(`code2Session ${r({ body })}`);
    return WeChatHelper.code2Session(body.code);
  }

  @Post('ticket')
  async ticket(@Body('type') type: WxTicketType, @Body('value') value: string): Promise<WxQrTicketInfo> {
    this.logger.log(`ticket ${r({ type, value })}`);
    return WeChatHelper.getTicketByType(type, value);
  }

  @UseGuards(WXAuthGuard)
  @Get('user-info')
  async userInfo(@Req() req: WXAuthRequest): Promise<WXMiniAppUserInfo> {
    const { payload, user, identifier } = req;
    this.logger.log(`get user-info ${r({ payload, user, identifier })}`);
    return WXMiniAppUserInfo.findOne({ where: { profileId: user.id }, relations: ['profile'] });
  }

  @UseGuards(WXAuthGuard)
  @Post('phone-number')
  async updatePhoneNumber(
    @Body() body: { encryptedData: string; errMsg: string; iv: string },
    @Req() req: WXAuthRequest,
  ): Promise<void> {
    const { payload, user } = req;
    this.logger.log(`update phone number for ${user.username}`);
    return WeChatHelper.updateUserPhoneNumber(payload, user, body);
  }

  @UseGuards(WXAuthGuard)
  @Post('user-info')
  async updateUserInfo(@Body() userInfo: UserInfo, @Req() req: WXAuthRequest): Promise<void> {
    const { user } = req;
    this.logger.log(`update user-info ${r(userInfo)} for ${user.username}`);
    return WeChatHelper.updateUserInfo(user, userInfo);
  }

  @UseGuards(WXAuthGuard)
  @Get('authorized')
  authorized(): void {}
}
