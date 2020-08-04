import { AlipaySdkCommonResult } from 'alipay-sdk';
import * as crypto from 'crypto';
import { sub } from 'date-fns';
import * as Handlebars from 'handlebars';
import * as _ from 'lodash';
import fetch from 'node-fetch';
import * as qs from 'qs';
import { IsNull, LessThan } from 'typeorm';
import { AsunaErrorCode, AsunaException } from '../common';
import { parseJSONIfCould, r } from '../common/helpers';
import { LoggerFactory } from '../common/logger';
import { ConfigKeys, configLoader } from '../config';
import { PaymentAlipayHelper } from './payment.alipay.helper';
import { PaymentItem, PaymentMethod, PaymentTransaction } from './payment.entities';
import { PaymentMethodEnumValue } from './payment.enum-values';
import { PaymentOrder } from './payment.order.entities';
import { PaymentWxpayHelper } from './payment.wxpay.helper';

const logger = LoggerFactory.getLogger('PaymentHelper');

export class PaymentHelper {
  static notifyHandlers: Record<string, (order: PaymentOrder) => any> = {};

  static async createOrder({
    itemId,
    methodId,
    paymentInfo,
    extra,
    profileId,
  }: {
    itemId: string;
    callback: string;
    methodId: number;
    paymentInfo: Record<string, unknown>;
    extra?: Record<string, unknown>;
    profileId: string;
  }): Promise<PaymentOrder> {
    logger.log(`create order by ${r({ itemId, methodId, profileId, paymentInfo, extra })}`);
    // create order first
    const item = await PaymentItem.findOneOrFail(itemId);
    const order = await PaymentOrder.create({ name: item.name, items: [item], amount: item.price, profileId }).save();
    const method = await PaymentMethod.findOneOrFail(methodId);
    // logger.log(`created order ${r({ item, method, order })}`);

    // create transaction
    await PaymentTransaction.create({
      // name: `${profileId}'s transaction`,
      method,
      paymentInfo,
      extra,
      profileId,
      order,
    }).save();
    await order.reload();
    logger.log(`created order is ${r(order)}`);
    return order;
  }

  static async validateSign(orderId: string, body): Promise<boolean> {
    const order = await PaymentOrder.findOneOrFail(orderId, { relations: ['transaction'] });
    const transaction = await PaymentTransaction.findOneOrFail(order.transaction.id, { relations: ['method'] });
    const { method, sign } = transaction;

    const remoteSignPath = _.get(method.extra, 'remoteSign');
    const remoteSign: string = _.get(body, remoteSignPath);

    transaction.data = body;
    await transaction.save();

    if (sign?.toLowerCase() !== remoteSign?.toLowerCase()) {
      logger.error(`invalid sign ${r({ sign, remoteSign, remoteSignPath })}`);
      transaction.status = 'error';
      await transaction.save();
      throw new Error('failure');
    }

    if (transaction.status !== 'done') {
      transaction.status = 'done';
      await transaction.save();
      order.status = 'paid';
      await order.save();
    }

    return true;
  }

  static async extraContext(
    transaction: PaymentTransaction,
    method: PaymentMethod,
    order: PaymentOrder,
  ): Promise<{
    method: PaymentMethod;
    order: PaymentOrder;
    transaction: PaymentTransaction;
    callback: string;
    notify: string;
    createdAt: Date;
  }> {
    const { createdAt } = transaction;
    const MASTER_HOST = configLoader.loadConfig(ConfigKeys.MASTER_ADDRESS);
    const callback = encodeURIComponent(`${MASTER_HOST}/api/v1/payment/callback`);
    const notify = encodeURIComponent(`${MASTER_HOST}/api/v1/payment/notify`);
    return { method, order, transaction, createdAt, callback, notify };
  }

  static async sign(transactionId: string): Promise<{ context; signed: string; md5sign: string }> {
    const transaction = await PaymentTransaction.findOneOrFail(transactionId, { relations: ['method', 'order'] });
    const { method, order } = transaction;
    if (!method) {
      throw new AsunaException(AsunaErrorCode.Unprocessable, `method not found for transaction: ${transactionId}`);
    }
    // const signTmpl = method?.signTmpl;
    const context = await this.extraContext(transaction, method, order);

    const signed = Handlebars.compile(method.signTmpl ?? '')(context);
    const md5 = crypto.createHash('md5').update(signed).digest('hex').toUpperCase();

    const md5sign = _.get(method.extra, 'lowercase') ? md5.toLowerCase() : md5.toUpperCase();
    return { context, signed, md5sign };
  }

  static async pay(
    transactionId: string,
    { callback, clientIp }: { callback?: string; clientIp?: string },
  ): Promise<string | AlipaySdkCommonResult | { payload: Record<string, unknown>; result?: string }> {
    const transaction = await PaymentTransaction.findOneOrFail(transactionId, { relations: ['method', 'order'] });
    const { method, order } = transaction;
    // const bodyTmpl = method?.bodyTmpl;
    if (!method) {
      throw new AsunaException(AsunaErrorCode.Unprocessable, `method not found for transaction: ${transactionId}`);
    }

    if (method.type === PaymentMethodEnumValue.types.alipay) {
      return PaymentAlipayHelper.createOrder(
        method,
        {
          cost: order.amount,
          name: order.name ? `${order.id}-${order.name}` : order.id,
          packParams: { ...(transaction.paymentInfo ?? {}), orderId: order.id },
        },
        callback,
      );
    }
    if (method.type === PaymentMethodEnumValue.types.wxpay) {
      return PaymentWxpayHelper.createOrder(
        method,
        {
          tradeNo: order.id,
          fee: order.amount,
          name: order.name ? `${order.id}-${order.name}` : order.id,
          clientIp,
        },
        callback,
      );
    }

    const { context, signed, md5sign } = await this.sign(transactionId);
    Object.assign(context, { md5sign });
    const body = Handlebars.compile(method.bodyTmpl ?? '')(context);

    logger.debug(`parse body '${body}' with context ${r(context)}`);

    const payload = JSON.parse(body);
    logger.log(`sign by ${r({ signed, payload })}`);
    transaction.sign = md5sign;
    transaction.status = 'signed';
    await transaction.save();
    order.status = 'waiting';
    await order.save();

    if (_.get(method.extra, 'method') === 'GET') {
      const url = `${method.endpoint}?${qs.stringify(payload)}`;
      const response = await fetch(url);
      const result = await response.text();
      logger.debug(`fetch ${url} response is ${result}`);
      if (result) {
        const parsed = parseJSONIfCould(result);
        await this.updateOrder(order.id, parsed);
        return { payload, result: parsed };
      }
    }

    return { payload };
  }

  static async updateOrder(orderId: string, data: any): Promise<PaymentOrder> {
    const order = await PaymentOrder.findOneOrFail(orderId, { relations: ['transaction'] });
    order.transaction.data = data;
    return order.save();
  }

  static async cleanExpiredPayments(): Promise<void> {
    const oneDayAgo = sub(new Date(), { days: 1 });
    const transactions = await PaymentTransaction.count({ createdAt: LessThan(oneDayAgo), status: IsNull() });
    logger.debug(`remove expired transactions: ${transactions}`);
    if (transactions) {
      await PaymentTransaction.delete({ createdAt: LessThan(oneDayAgo), status: IsNull() });
    }

    // const orders = await PaymentOrder.count({ where: { createdAt: LessThan(oneDayAgo), status: IsNull() } });
    // logger.debug(`remove expired orders: ${orders}`);
    // await PaymentOrder.delete({ createdAt: LessThan(oneDayAgo), status: IsNull() });
  }

  static async handleNotify(orderId: string | undefined, data: any, isWxPay?: boolean): Promise<void> {
    if (isWxPay) {
      const body = data as {
        appid: string;
        bank_type: 'OTHERS';
        cash_fee: string;
        device_info: 'WEB';
        fee_type: 'CNY';
        is_subscribe: 'N';
        mch_id: string;
        nonce_str: string;
        openid: string;
        out_trade_no: string;
        result_code: 'SUCCESS';
        return_code: 'SUCCESS';
        sign: string;
        time_end: string;
        total_fee: string;
        trade_type: 'MWEB';
        transaction_id: string;
      };
      const validated = await PaymentWxpayHelper.validateSign(body);
      logger.debug(`validated wxpay is ${r(validated)}`);
      if (!validated) {
        // logger.error(`${body.subject} not validated.`);
        throw new AsunaException(AsunaErrorCode.Unprocessable, `${body.out_trade_no} not validated.`);
      }

      // const params = parseJSONIfCould(body.passback_params);
      logger.debug(`find order ${body.out_trade_no}`);
      const order = await PaymentOrder.findOneOrFail(body.out_trade_no, { relations: ['transaction'] });
      logger.debug(`update order ${r({ order, body })} status to done`);
      order.transaction.status = 'done';
      order.transaction.data = body;
      await order.transaction.save();
      order.status = 'done';
      await order.save();

      _.each(this.notifyHandlers, (handler) => handler(order));
      return;
    } else {
      // handle as alipay
      const body = data as {
        app_id: string;
        auth_app_id: string;
        buyer_id: string;
        buyer_pay_amount: string;
        charset: string;
        fund_bill_list: { amount: string; fundChannel: string }[];
        gmt_create: Date;
        gmt_payment: Date;
        invoice_amount: number;
        notify_id: string;
        notify_time: Date;
        notify_type: string; // trade_status_sync
        out_trade_no: string;
        passback_params: any;
        point_amount: number;
        receipt_amount: number;
        seller_id: string;
        sign: string;
        sign_type: string;
        subject: string;
        total_amount: number;
        trade_no: string;
        trade_status: string; // TRADE_SUCCESS
        version: string;
      };

      const validated = await PaymentAlipayHelper.validateSign(body);
      logger.debug(`validated alipay is ${r(validated)}`);
      if (!validated) {
        // logger.error(`${body.subject} not validated.`);
        throw new AsunaException(AsunaErrorCode.Unprocessable, `${body.subject} not validated.`);
      }

      const params = parseJSONIfCould(body.passback_params);
      logger.debug(`find order ${params.orderId ?? body.subject}`);
      const order = await PaymentOrder.findOneOrFail(params.orderId ?? body.subject, { relations: ['transaction'] });
      logger.debug(`update order ${r({ order, body })} status to done`);
      order.transaction.status = 'done';
      order.transaction.data = body;
      await order.transaction.save();
      order.status = 'done';
      await order.save();

      _.each(this.notifyHandlers, (handler) => handler(order));
      return;
    }

    // throw new AsunaException(AsunaErrorCode.Unprocessable, 'alipay or wxpay support only');
  }
}
