import { Body, Controller, Post, Put, Req, Res, UseGuards } from '@nestjs/common';
import { IsBoolean, IsDefined, IsOptional, IsString, isURL } from 'class-validator';
import { Request, Response } from 'express';
import * as _ from 'lodash';
import { r } from '../common/helpers';
import { LoggerFactory } from '../common/logger';
import { JwtAuthGuard, JwtAuthRequest } from '../core/auth';
import { SMSConfigObject } from '../sms';
import { SMSVerifyCodeGuard } from '../sms/guards';
import { SMSHelper } from '../sms/helper';
import { WeChatHelper } from '../wechat';
import { PaymentHelper } from './payment.helper';

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
  private config = SMSConfigObject.load();

  @Post('notify')
  public async postNotify(@Body() body, @Req() req: Request) {
    const isWxPay = _.isEmpty(body);
    const data = isWxPay ? await WeChatHelper.parseXmlToJson(req) : body;
    logger.log(`notify ${r(data)}`);
    const order = await PaymentHelper.handleNotify(body?.id, data, isWxPay);
    if (order) {
      const tmplPath = 'payment-success';
      const tmplId = _.get(this.config.templates, tmplPath);
      const phonePath = 'paymentInfo.mobile';
      const phoneNumber = _.get(body, phonePath);
      if (this.config.enable) {
        if (tmplId && phoneNumber) {
          SMSHelper.sendSMS(tmplId, phoneNumber).catch((reason) => logger.error(reason));
        } else {
          logger.error(`send payment-success message error ${r({ tmplPath, tmplId, phonePath, phoneNumber })}`);
        }
      }
    }
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
