import { Body, Controller, Get, Post, Put, Query, Req, Res, UseGuards } from '@nestjs/common';
import { IsDefined, IsOptional, IsString, isURL } from 'class-validator';
import { Request, Response } from 'express';
import * as _ from 'lodash';
import { r } from '../common/helpers';
import { LoggerFactory } from '../common/logger';
import { JwtAuthGuard, JwtAuthRequest } from '../core/auth';
import { WeChatHelper } from '../wechat';
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
  @Get('notify')
  getNotify(@Query() query) {
    logger.log(`notify ${r({ query })}`);
    return PaymentHelper.handleNotify(query?.id, query);
  }

  @Post('notify')
  async postNotify(@Body() body, @Req() req: Request) {
    const data = await WeChatHelper.parseXmlToJson(req);
    logger.log(`notify ${r({ body, data })}`);
    const isWxPay = !_.isEmpty(data);
    return PaymentHelper.handleNotify(body?.id, isWxPay ? data : body, isWxPay);
  }

  @Get('callback')
  callback(@Query() query, @Body() body) {
    logger.log(`callback ${r({ query, body })}`);
  }

  @UseGuards(new JwtAuthGuard({ anonymousSupport: true }))
  @Post('order')
  async createOrder(@Body() body: CreateOrderDTO, @Req() req: JwtAuthRequest, @Res() res: Response): Promise<any> {
    const order = await PaymentHelper.createOrder({ ...body, profileId: req.payload?.id });
    const result = await PaymentHelper.pay(order.transaction.id, { callback: body.callback, clientIp: req.clientIp });
    return _.isString(result) && isURL(result) ? res.redirect(result) : res.send(result);
  }

  @UseGuards(new JwtAuthGuard())
  @Put('order')
  async updateOrder(@Body() body: UpdateOrderDTO) {
    return PaymentHelper.updateOrder(body.orderId, body.data);
  }
}
