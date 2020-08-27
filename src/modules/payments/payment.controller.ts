import { Body, Controller, Post, Put, Query, Req, Res, UseGuards } from '@nestjs/common';
import { IsDefined, IsOptional, IsString, isURL } from 'class-validator';
import { Request, Response } from 'express';
import * as _ from 'lodash';
import { r } from '../common/helpers';
import { LoggerFactory } from '../common/logger';
import { JwtAuthGuard, JwtAuthRequest } from '../core/auth/auth.guard';
import { WeChatHelper } from '../wechat/wechat.helper';
import { PaymentHelper } from './payment.helper';

class CreateOrderDTO {
  @IsString()
  itemId: string;
  @IsString()
  callback: string;
  @IsDefined()
  methodId: number;
  @IsDefined()
  paymentInfo: Record<string, unknown>;
  @IsOptional()
  extra?: Record<string, unknown>;
}

class UpdateOrderDTO {
  @IsString()
  orderId: string;
  @IsOptional()
  data?: Record<string, unknown>;
}

const logger = LoggerFactory.getLogger('PaymentController');

@Controller('api/v1/payment')
export class PaymentController {
  @Post('notify')
  async postNotify(@Body() body, @Req() req: Request) {
    const isWxPay = _.isEmpty(body);
    const data = isWxPay ? await WeChatHelper.parseXmlToJson(req) : body;
    logger.log(`notify ${r(data)}`);
    return PaymentHelper.handleNotify(body?.id, data, isWxPay);
  }

  @UseGuards(new JwtAuthGuard({ anonymousSupport: true }))
  @Post('order')
  async createOrder(
    @Query('useWxJsApi') useWxJsApi: boolean,
    @Body() body: CreateOrderDTO,
    @Req() req: JwtAuthRequest,
    @Res() res: Response,
  ): Promise<void> {
    logger.log(`createOrder ${r(body)}`);
    const order = await PaymentHelper.createOrder({ ...body, profileId: req.payload?.id });
    const result = await PaymentHelper.pay(order.transactionId, {
      callback: body.callback,
      clientIp: req.clientIp,
      wxJsApi: useWxJsApi,
    });
    if (_.isString(result) && isURL(result)) {
      res.redirect(result);
    } else {
      res.send(result);
    }
  }

  @UseGuards(new JwtAuthGuard())
  @Put('order')
  async updateOrder(@Body() body: UpdateOrderDTO) {
    return PaymentHelper.updateOrder(body.orderId, body.data);
  }
}
