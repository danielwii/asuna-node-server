import * as crypto from 'crypto';
import * as dayjs from 'dayjs';
import * as Handlebars from 'handlebars';
import { EntityManager, TransactionManager } from 'typeorm';
import { r } from '../common/helpers/utils';
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

  static async pay(transactionId: string): Promise<any> {
    const transaction = await PaymentTransaction.findOneOrFail(transactionId, { relations: ['method', 'order'] });
    const { method, order } = transaction;
    const signTmpl = method?.signTmpl;
    const bodyTmpl = method?.bodyTmpl;

    const createdAt = dayjs(transaction.createdAt).format('YYYY-MM-DD HH:mm:ss');
    const MASTER_HOST = configLoader.loadConfig(ConfigKeys.MASTER_ADDRESS);

    const context = {
      method,
      order,
      transaction,
      createdAt,
      callback: encodeURIComponent(`${MASTER_HOST}/api/v1/payment/callback`),
      notify: encodeURIComponent(`${MASTER_HOST}/api/v1/payment/notify`),
    };
    const signed = Handlebars.compile(signTmpl)(context);
    const md5 = crypto
      .createHash('md5')
      .update(signed)
      .digest('hex')
      .toUpperCase();

    const body = Handlebars.compile(bodyTmpl)(Object.assign(context, { md5sign: md5 }));

    logger.verbose(`parse body ${body}`);

    const payload = JSON.parse(body);
    logger.log(`sign by ${r({ md5, signed, payload })}`);

    return body;
  }

  // static async close(orderId: string): Promise<PaymentOrder> {
  //   const order = await PaymentOrder.findOneOrFail(orderId);
  //   // ... set status to done
  // }
}
