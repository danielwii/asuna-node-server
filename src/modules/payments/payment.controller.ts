import { Body, Controller, Get, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import { IsDefined, IsOptional, IsString } from 'class-validator';
import { r } from '../common/helpers';
import { LoggerFactory } from '../common/logger';
import { JwtAuthGuard, JwtAuthRequest } from '../core/auth';
import { PaymentHelper } from './payment.helper';

class CreateOrderDTO {
  @IsString()
  itemId: string;
  @IsString()
  callback: string;
  @IsDefined()
  methodId: number;
  @IsDefined()
  paymentInfo: object;
}

class UpdateOrderDTO {
  @IsString()
  orderId: string;
  @IsOptional()
  data?: any;
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
  postNotify(@Body() body) {
    logger.log(`notify ${r({ body })}`);
    return PaymentHelper.handleNotify(body?.id, body);
  }

  @Get('callback')
  callback(@Query() query, @Body() body) {
    logger.log(`callback ${r({ query, body })}`);
  }

  @UseGuards(new JwtAuthGuard({ anonymousSupport: true }))
  @Post('order')
  async createOrder(@Body() body: CreateOrderDTO, @Req() req: JwtAuthRequest): Promise<any> {
    const order = await PaymentHelper.createOrder({ ...body, profileId: req.payload?.id });
    return PaymentHelper.pay(order.transaction.id, body.callback);
  }

  @UseGuards(new JwtAuthGuard())
  @Put('order')
  async updateOrder(@Body() body: UpdateOrderDTO) {
    return PaymentHelper.updateOrder(body.orderId, body.data);
  }
}
