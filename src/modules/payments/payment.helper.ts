import * as crypto from 'crypto';
import * as Handlebars from 'handlebars';
import * as _ from 'lodash';
import fetch from 'node-fetch';
import * as qs from 'qs';
import { EntityManager, TransactionManager } from 'typeorm';
import { parseJSONIfCould, r } from '../common/helpers/utils';
import { LoggerFactory } from '../common/logger';
import { ConfigKeys, configLoader } from '../config';
import { PaymentItem, PaymentMethod, PaymentOrder, PaymentTransaction } from './payment.entities';

const logger = LoggerFactory.getLogger('PaymentHelper');

export class PaymentHelper {
  static async createOrder(
    {
      itemId,
      methodId,
      paymentInfo,
      profileId,
    }: {
      itemId: string;
      methodId: number;
      paymentInfo: object;
      profileId: string;
    },
    @TransactionManager() manager?: EntityManager,
  ): Promise<PaymentOrder> {
    logger.log(`create order by ${r({ itemId, methodId, profileId })}`);
    // create order first
    const item = await PaymentItem.findOneOrFail(itemId);
    const order = await PaymentOrder.create({
      // name: `${profileId}'s order`,
      items: [item],
      amount: item.price,
      profileId,
    }).save();

    logger.verbose(`create order by ${r({ item, order })}`);

    // create transaction
    const method = await PaymentMethod.findOneOrFail(methodId);
    order.transaction = await PaymentTransaction.create({
      // name: `${profileId}'s transaction`,
      method,
      paymentInfo,
      profileId,
      order: order as any,
    }).save();
    return order.save();
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

  static async extraContext(transaction: PaymentTransaction, method: PaymentMethod, order: PaymentOrder): Promise<any> {
    const { createdAt } = transaction;
    const MASTER_HOST = configLoader.loadConfig(ConfigKeys.MASTER_ADDRESS);
    return {
      method,
      order,
      transaction,
      createdAt,
      callback: encodeURIComponent(`${MASTER_HOST}/api/v1/payment/callback`),
      notify: encodeURIComponent(`${MASTER_HOST}/api/v1/payment/notify`),
    };
  }

  static async sign(transactionId: string): Promise<{ context; signed: string; md5sign: string }> {
    const transaction = await PaymentTransaction.findOneOrFail(transactionId, { relations: ['method', 'order'] });
    const { method, order } = transaction;
    const signTmpl = method?.signTmpl;
    const context = await this.extraContext(transaction, method, order);

    const signed = Handlebars.compile(signTmpl)(context);
    const md5 = crypto
      .createHash('md5')
      .update(signed)
      .digest('hex')
      .toUpperCase();

    const md5sign = _.get(method.extra, 'lowercase') ? md5.toLowerCase() : md5.toUpperCase();
    return { context, signed, md5sign };
  }

  static async pay(transactionId: string): Promise<any> {
    const transaction = await PaymentTransaction.findOneOrFail(transactionId, { relations: ['method', 'order'] });
    const { method, order } = transaction;
    const bodyTmpl = method?.bodyTmpl;

    const { context, signed, md5sign } = await this.sign(transactionId);
    Object.assign(context, { md5sign });
    const body = Handlebars.compile(bodyTmpl)(context);

    logger.verbose(`parse body ${r({ body, context })}`);

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
      logger.verbose(`fetch ${url} response is ${result}`);
      if (result) {
        const parsed = parseJSONIfCould(result);
        await this.updateOrder(order.id, parsed);
        return { payload, result: parsed };
      }
    }

    return { payload };
  }

  static async updateOrder(orderId: string, data: any) {
    const order = await PaymentOrder.findOneOrFail(orderId, { relations: ['transaction'] });
    order.transaction.data = data;
    return order.save();
  }
}
