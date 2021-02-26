import axios from 'axios';
import { Promise } from 'bluebird';
import Chance from 'chance';
import * as crypto from 'crypto';
import * as _ from 'lodash';
import * as qs from 'qs';
import { IsNull } from 'typeorm';
import * as xml2js from 'xml2js';

import { AsunaErrorCode, AsunaException, r } from '../common';
import { LoggerFactory } from '../common/logger';
import { AppConfigObject } from '../config/app.config';
import { PaymentMethod } from './payment.entities';
import { PaymentHelper } from './payment.helper';
import { PaymentOrder } from './payment.order.entities';

const logger = LoggerFactory.getLogger('PaymentWxpayHelper');
const chance = new Chance();

type TradeType = 'MWEB' | 'JSAPI' | 'APP' | 'NATIVE';

export class PaymentWxpayHelper {
  public static async checkPaymentStatus() {
    const [orders, count] = await PaymentOrder.findAndCount({
      where: { status: IsNull() },
      relations: ['transaction', 'transaction.method'],
    });
    if (count) {
      logger.log(`check payment orders: ${count}`);
      await Promise.mapSeries(orders, async (order) => {
        // logger.log(`handle order ${r(order)}`);
        if (!order.transaction) {
          logger.error(`no transaction found for transaction ${r(order)}`);
          return Promise.resolve();
        }
        if (!order.transaction.method) {
          logger.error(`no method found for transaction ${r(order.transaction)}`);
          return Promise.resolve();
        }
        if (order.transaction.method.type !== 'wxpay') {
          logger.verbose(`order type is ${order.transaction.method.type}, ignore it.`);
          return Promise.resolve();
        }
        await order.reload();
        if (order.status === 'done') {
          logger.verbose(`${order.id} already handled`);
          return Promise.resolve();
        }
        const queried = await PaymentWxpayHelper.query(order.id);
        if (queried.trade_state === 'SUCCESS') {
          logger.log(`update order ${order.id} status to done.`);
          order.transaction.status = 'done';
          order.transaction.data = queried;
          await order.transaction.save();
          order.status = 'done';
          await order.save();

          _.each(PaymentHelper.notifyHandlers, (handler) => handler(order));
          PaymentHelper.noticePaymentOrderUser(order);
          return order;
        }
      });
    }
  }

  public static async query(id: string): Promise<any> {
    const order = await PaymentOrder.findOneOrFail(id, { relations: ['transaction', 'transaction.method'] });
    const method = order.transaction.method;
    logger.log(`query order ${r({ id, order })}`);
    const queryObject = {
      appid: method.apiKey,
      mch_id: method.merchant,
      device_info: 'WEB',
      nonce_str: chance.string({ length: 32, alpha: true, numeric: true }),
      out_trade_no: id,
    };
    const secretKey = _.get(method.extra, 'secretKey') as string;
    if (_.isEmpty(secretKey)) {
      throw new AsunaException(AsunaErrorCode.Unprocessable, `secretKey not found`);
    }
    const signStr = `${qs.stringify(queryObject, {
      encode: false,
      sort: (a, b) => a.localeCompare(b),
    })}&key=${secretKey}`;
    const sign = crypto.createHash('md5').update(signStr).digest('hex').toUpperCase();
    const signedQueryObject = { ...queryObject, sign };
    const xmlData = new xml2js.Builder({ xmldec: undefined, rootName: 'xml', cdata: true }).buildObject(
      signedQueryObject,
    );
    const response = await axios.post('https://api.mch.weixin.qq.com/pay/orderquery', xmlData);
    const json = (await Promise.promisify(xml2js.parseString)(response.data)) as { xml: { [key: string]: any[] } };
    const data = _.mapValues(json.xml, (value) => (_.isArray(value) && value.length === 1 ? _.head(value) : value));
    logger.debug(`response is ${r(data)}`);
    return data;
  }

  public static async createOrder(
    method: PaymentMethod,
    { openid, tradeType }: { openid: string; tradeType: TradeType },
    goods: {
      // 商户系统内部订单号，要求32个字符内，只能是数字、大小写字母_-|* 且在同一个商户号下唯一。
      tradeNo: string;
      name: string;
      fee: number;
      clientIp: string;
    },
  ): Promise<Record<string, unknown>> {
    logger.log(`create order ${r({ method, goods, openid })}`);
    const xmlData = await this.createXmlData(method, goods, tradeType, { openid });
    const response = await axios.post('https://api.mch.weixin.qq.com/pay/unifiedorder', xmlData);
    const json = (await Promise.promisify(xml2js.parseString)(response.data)) as { xml: { [key: string]: any[] } };
    const data = _.mapValues(json.xml, (value) => (_.isArray(value) && value.length === 1 ? _.head(value) : value));
    logger.debug(`response is ${r(data)}`);
    if (data.return_code !== 'SUCCESS') {
      throw new AsunaException(AsunaErrorCode.Unprocessable, response.data);
    }
    return data;
  }

  public static async createPaymentOrder(
    method: PaymentMethod,
    goods: {
      // 商户系统内部订单号，要求32个字符内，只能是数字、大小写字母_-|* 且在同一个商户号下唯一。
      tradeNo: string;
      name: string;
      fee: number;
      clientIp: string;
    },
    { redirectUrl, isMobile }: { redirectUrl?: string; isMobile?: boolean },
  ): Promise<string> {
    logger.log(`create payment order ${r({ method, goods, redirectUrl })}`);
    const xmlData = await this.createXmlData(method, goods);
    const response = await axios.post(method.endpoint, xmlData);
    const json = (await Promise.promisify(xml2js.parseString)(response.data)) as { xml: { [key: string]: any[] } };
    const data = _.mapValues(json.xml, (value) => (_.isArray(value) && value.length === 1 ? _.head(value) : value));
    logger.debug(`response is ${r(data)}`);

    if (data.return_code !== 'SUCCESS') {
      throw new AsunaException(AsunaErrorCode.Unprocessable, response.data);
    }
    return `${data.mweb_url}&redirect_url=${redirectUrl}`;
  }

  public static async validateSign(body: Record<string, string>): Promise<boolean> {
    // const order = await PaymentOrder.findOneOrFail(body.out_trade_no, { relations: ['transaction'] });
    return true; // todo ...
  }

  private static async createXmlData(
    method: PaymentMethod,
    goods: { tradeNo: string; name: string; fee: number; clientIp: string },
    tradeType: TradeType = 'MWEB',
    extra: { openid?: string } = {},
  ): Promise<string> {
    logger.debug(`create xml data ${r({ method, goods, tradeType, extra })}`);
    const MASTER_HOST = AppConfigObject.load().masterAddress;
    const notifyUrl = _.get(method.extra, 'notifyUrl') || `${MASTER_HOST}/api/v1/payment/notify`;
    if (_.isEmpty(notifyUrl)) {
      throw new AsunaException(AsunaErrorCode.Unprocessable, 'no notify url defined.');
    }

    const totalFee = _.toNumber(goods.fee) * 100;
    const signObject = {
      appid: method.apiKey,
      mch_id: method.merchant,
      device_info: 'WEB',
      body: goods.name,
      nonce_str: chance.string({ length: 32, alpha: true, numeric: true }),
      out_trade_no: goods.tradeNo,
      total_fee: totalFee,
      trade_type: tradeType,
      spbill_create_ip: goods.clientIp,
      notify_url: notifyUrl,
      ...extra,
    };
    const secretKey = _.get(method.extra, 'secretKey') as string;
    if (_.isEmpty(secretKey)) {
      throw new AsunaException(AsunaErrorCode.Unprocessable, `secretKey not found`);
    }
    const signStr = `${qs.stringify(signObject, {
      encode: false,
      sort: (a, b) => a.localeCompare(b),
    })}&key=${secretKey}`;
    const sign = crypto.createHash('md5').update(signStr).digest('hex').toUpperCase();

    const postBody = { ...signObject, sign };

    const xmlData = new xml2js.Builder({ xmldec: undefined, rootName: 'xml', cdata: true }).buildObject(postBody);

    logger.debug(`signed ${r({ signObject, signStr, sign, postBody, xmlData, notify_url: notifyUrl })}`);
    return xmlData;
  }
}
