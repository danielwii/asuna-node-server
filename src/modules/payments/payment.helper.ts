import { AsunaErrorCode, AsunaException } from '@danielwii/asuna-helper/dist/exceptions';
import { LoggerFactory } from '@danielwii/asuna-helper/dist/logger';
import { r } from '@danielwii/asuna-helper/dist/serializer';
import { parseJSONIfCould } from '@danielwii/asuna-helper/dist/utils';

import * as crypto from 'crypto';
import { sub } from 'date-fns';
import * as Handlebars from 'handlebars';
import _ from 'lodash';
import fetch from 'node-fetch';
import * as qs from 'qs';
import { IsNull, LessThan } from 'typeorm';

import { AppConfigObject } from '../config/app.config';
import { SMSConfigObject } from '../sms';
import { PaymentAlipayHelper } from './payment.alipay.helper';
import { PaymentItem, PaymentMethod, PaymentTransaction } from './payment.entities';
import { PaymentMethodEnumValue } from './payment.enum-values';
import { PaymentOrder } from './payment.order.entities';
import { PaymentWxpayHelper } from './payment.wxpay.helper';

import type { AlipaySdkCommonResult } from 'alipay-sdk';

const logger = LoggerFactory.getLogger('PaymentHelper');

interface PaymentContext {
  method: PaymentMethod;
  order: PaymentOrder;
  transaction: PaymentTransaction;
  callback: string;
  notify: string;
  createdAt: Date;
}

export class PaymentHelper {
  private static config = SMSConfigObject.load();

  public static async createOrder({
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

  public static async validateSign(orderId: string, body): Promise<boolean> {
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

  public static async extraContext(
    transaction: PaymentTransaction,
    method: PaymentMethod,
    order: PaymentOrder,
  ): Promise<PaymentContext> {
    const { createdAt } = transaction;
    const MASTER_HOST = AppConfigObject.load().masterAddress;
    const callback = encodeURIComponent(`${MASTER_HOST}/api/v1/payment/callback`);
    const notify = encodeURIComponent(`${MASTER_HOST}/api/v1/payment/notify`);
    return { method, order, transaction, createdAt, callback, notify };
  }

  public static async sign(
    transactionId: string,
  ): Promise<{ context: PaymentContext; signed: string; md5sign: string }> {
    const transaction = await PaymentTransaction.findOneOrFail(transactionId, { relations: ['method', 'order'] });
    const { method, order } = transaction;
    if (!method) {
      throw new AsunaException(AsunaErrorCode.Unprocessable, `method not found for transaction: ${transactionId}`);
    }
    // const signTmpl = method?.signTmpl;
    const context = await PaymentHelper.extraContext(transaction, method, order);

    const signed = Handlebars.compile(method.signTmpl ?? '')(context);
    const md5 = crypto.createHash('md5').update(signed).digest('hex').toUpperCase();

    const md5sign = _.get(method.extra, 'lowercase') ? md5.toLowerCase() : md5.toUpperCase();
    return { context, signed, md5sign };
  }

  public static async pay(
    transactionId: string,
    {
      callback,
      clientIp,
      wxJsApi,
      openid,
      isMobile,
    }: { callback?: string; clientIp?: string; wxJsApi?: boolean; openid?: string; isMobile?: boolean },
  ): Promise<
    string | AlipaySdkCommonResult | { payload: Record<string, unknown>; result?: string } | Record<string, unknown>
  > {
    logger.log(`pay ${r({ transactionId, callback, clientIp, wxJsApi, openid, isMobile })}`);
    const transaction = await PaymentTransaction.findOneOrFail(transactionId, { relations: ['method', 'order'] });
    const { method, order } = transaction;
    // const bodyTmpl = method?.bodyTmpl;
    if (!method) {
      throw new AsunaException(AsunaErrorCode.Unprocessable, `method not found for transaction: ${transactionId}`);
    }

    const name = order.name ? `${order.name}-${order.id}` : order.id;
    if (method.type === PaymentMethodEnumValue.types.alipay) {
      return PaymentAlipayHelper.createPaymentOrder(
        method,
        { cost: order.amount, name, packParams: { ...(transaction.paymentInfo ?? {}), orderId: order.id } },
        { returnUrl: callback, isMobile },
      );
    }
    if (method.type === PaymentMethodEnumValue.types.wxpay) {
      if (wxJsApi) {
        return PaymentWxpayHelper.createOrder(
          method,
          { openid, tradeType: 'JSAPI' },
          { tradeNo: order.id, fee: order.amount, name, clientIp },
        );
      }
      if (isMobile) {
        return PaymentWxpayHelper.createPaymentOrder(
          method,
          { tradeNo: order.id, fee: order.amount, name, clientIp },
          { redirectUrl: callback, isMobile },
        );
      }
      return PaymentWxpayHelper.createOrder(
        method,
        { openid, tradeType: 'NATIVE' },
        { tradeNo: order.id, fee: order.amount, name, clientIp },
      );
    }

    const { context, signed, md5sign } = await PaymentHelper.sign(transactionId);
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

  public static async updateOrder(orderId: string, data: any): Promise<PaymentOrder> {
    const order = await PaymentOrder.findOneOrFail(orderId, { relations: ['transaction'] });
    order.transaction.data = data;
    return order.save();
  }

  public static async cleanExpiredPayments(): Promise<void> {
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
}
