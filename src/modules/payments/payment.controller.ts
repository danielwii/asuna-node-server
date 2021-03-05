import { Body, Controller, Post, Put, Req, Res, UseGuards } from '@nestjs/common';
import { IsBoolean, IsDefined, IsOptional, IsString, isURL } from 'class-validator';
import { Request, Response } from 'express';
import * as _ from 'lodash';
import { r } from '../common/helpers';
import { LoggerFactory } from '../common/logger';
import { JwtAuthGuard, JwtAuthRequest } from '../core/auth';
import { SMSVerifyCodeGuard } from '../sms/guards';
import { WeChatHelper } from '../wechat';
import { PaymentHelper } from './payment.helper';
import { PaymentNotifyHelper } from './payment.notify';

class CreateOrderDTO {
  @IsString()
  public itemId: string;
  @IsString()
  public callback: string;
  @IsDefined()
  public methodId: number;
  @IsDefined()
  public paymentInfo: Record<'mobile' | string, unknown>;
  @IsOptional()
  public extra?: Record<string, unknown>;
  @IsBoolean()
  @IsOptional()
  public useWxJsApi?: boolean;
  @IsString()
  @IsOptional()
  public openid?: string;
}

class UpdateOrderDTO {
  @IsString()
  public orderId: string;
  @IsOptional()
  public data?: Record<string, unknown>;
}

const logger = LoggerFactory.getLogger('PaymentController');

@Controller('api/v1/payment')
export class PaymentController {
  // @Get('query/:id')
  // public async queryOrder(@Param('id') id) {
  //   return PaymentWxpayHelper.query(id);
  // }

  @Post('notify')
  public async postNotify(@Body() body, @Req() req: Request) {
    const isWxPay = _.isEmpty(body);
    const data = isWxPay ? await WeChatHelper.parseXmlToJson(req) : body;
    logger.log(`notify ${r(data)}`);
    await PaymentNotifyHelper.handlePaymentNotify(data, isWxPay);
  }

  @UseGuards(new JwtAuthGuard({ anonymousSupport: true }), SMSVerifyCodeGuard)
  @Post('order')
  public async createOrder(
    @Body() body: CreateOrderDTO,
    @Req() req: JwtAuthRequest,
    @Res() res: Response,
  ): Promise<void> {
    logger.log(`createOrder ${r(body)}`);
    const order = await PaymentHelper.createOrder({ ...body, profileId: req.payload?.id });
    const result = await PaymentHelper.pay(order.transactionId, {
      callback: body.callback,
      clientIp: req.clientIp,
      wxJsApi: body.useWxJsApi,
      openid: body.openid,
      isMobile: req.isMobile,
    });
    logger.log(`payment result is ${r(result)}`);
    if (_.isString(result) && isURL(result)) {
      res.redirect(result);
    } else {
      res.send({ result, order });
    }
  }

  @UseGuards(new JwtAuthGuard())
  @Put('order')
  public async updateOrder(@Body() body: UpdateOrderDTO) {
    return PaymentHelper.updateOrder(body.orderId, body.data);
  }
}
