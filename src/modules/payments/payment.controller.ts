import { Body, Controller, Logger, Post, Put, Req, Res, UseGuards } from '@nestjs/common';

import { resolveModule } from '@danielwii/asuna-helper/dist/logger/factory';
import { r } from '@danielwii/asuna-helper/dist/serializer';

import { IsBoolean, IsDefined, IsOptional, IsString, isURL } from 'class-validator';
import * as _ from 'lodash';

import { JwtAuthGuard, JwtAuthRequest } from '../core/auth';
import { SMSVerifyCodeGuard } from '../sms/guards';
import { WeChatHelper } from '../wechat';
import { PaymentHelper } from './payment.helper';
import { PaymentNotifyHelper } from './payment.notify';

import type { Request, Response } from 'express';
import { fileURLToPath } from "url";

class CreateOrderDTO {
  @IsString()
  itemId: string;
  @IsString()
  callback: string;
  @IsDefined()
  methodId: string;
  @IsDefined()
  paymentInfo: Record<'mobile' | string, unknown>;
  @IsOptional()
  extra?: Record<string, unknown>;
  @IsBoolean()
  @IsOptional()
  useWxJsApi?: boolean;
  @IsString()
  @IsOptional()
  openid?: string;
}

class UpdateOrderDTO {
  @IsString()
  orderId: string;
  @IsOptional()
  data?: Record<string, unknown>;
}

@Controller('api/v1/payment')
export class PaymentController {
  private readonly logger = new Logger(resolveModule(fileURLToPath(import.meta.url), this.constructor.name));

  // @Get('query/:id')
  //  async queryOrder(@Param('id') id) {
  //   return PaymentWxpayHelper.query(id);
  // }

  @Post('notify')
  async postNotify(@Body() body, @Req() req: Request) {
    const isWxPay = _.isEmpty(body);
    const data = isWxPay ? await WeChatHelper.parseXmlToJson(req) : body;
    this.logger.log(`notify ${r(data)}`);
    await PaymentNotifyHelper.handlePaymentNotify(data, isWxPay);
  }

  @UseGuards(new JwtAuthGuard({ anonymousSupport: true }), SMSVerifyCodeGuard)
  @Post('order')
  async createOrder(@Body() body: CreateOrderDTO, @Req() req: JwtAuthRequest, @Res() res: Response): Promise<void> {
    this.logger.log(`createOrder ${r(body)}`);
    const order = await PaymentHelper.createOrder({ ...body, profileId: req.payload?.id });
    const result = await PaymentHelper.pay(order.transactionId, {
      callback: body.callback,
      clientIp: req.clientIp,
      wxJsApi: body.useWxJsApi,
      openid: body.openid,
      isMobile: req.isMobile,
    });
    this.logger.log(`payment result is ${r(result)}`);
    if (_.isString(result) && isURL(result)) {
      res.redirect(result);
    } else {
      res.send({ result, order });
    }
  }

  @UseGuards(new JwtAuthGuard())
  @Put('order')
  async updateOrder(@Body() body: UpdateOrderDTO) {
    return PaymentHelper.updateOrder(body.orderId, body.data);
  }
}
