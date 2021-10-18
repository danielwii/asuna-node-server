import { AsunaErrorCode, AsunaException } from '@danielwii/asuna-helper/dist/exceptions';
import { LoggerFactory } from '@danielwii/asuna-helper/dist/logger/factory';
import { r } from '@danielwii/asuna-helper/dist/serializer';
import { parseJSONIfCould } from '@danielwii/asuna-helper/dist/utils';

import _ from 'lodash';

import { SMSConfigObject, SMSHelper } from '../sms';
import { PaymentAlipayHelper } from './payment.alipay.helper';
import { PaymentOrder } from './payment.order.entities';

const logger = LoggerFactory.getLogger('PaymentNotifyHelper');

export class PaymentNotifyHelper {
  private static config = SMSConfigObject.load();

  public static notifyHandlers: Record<string, (order: PaymentOrder) => any> = {};

  public static async handlePaymentNotify(data: any, isWxPay?: boolean): Promise<PaymentOrder | undefined> {
    const order = await PaymentNotifyHelper.handleNotify(data, isWxPay);
    PaymentNotifyHelper.noticePaymentOrderUser(order);
    return order;
  }

  public static noticePaymentOrderUser(order: PaymentOrder): void {
    if (order) {
      const tmplPath = 'payment-success';
      const tmplId = _.get(PaymentNotifyHelper.config.templates, tmplPath);
      const phonePath = 'paymentInfo.mobile';
      const phoneNumber = _.get(order.transaction, phonePath);
      if (PaymentNotifyHelper.config.enable) {
        if (tmplId && phoneNumber) {
          SMSHelper.sendSMS(tmplId, phoneNumber).catch((reason) => logger.error(reason));
        } else {
          logger.error(`send payment-success message error ${r({ tmplPath, tmplId, phonePath, phoneNumber })}`);
        }
      }
    }
  }

  public static async handleNotify(data: any, isWxPay?: boolean): Promise<PaymentOrder | undefined> {
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
      const validated = true; // TODO await PaymentWxpayHelper.validateSign(body);
      logger.log(`validated wxpay is ${r(validated)}`);
      if (!validated) {
        // logger.error(`${body.subject} not validated.`);
        throw new AsunaException(AsunaErrorCode.Unprocessable, `${body.out_trade_no} not validated.`);
      }

      // const params = parseJSONIfCould(body.passback_params);
      logger.log(`find order ${body.out_trade_no}`);
      const order = await PaymentOrder.findOneOrFail(body.out_trade_no, { relations: ['transaction'] });
      logger.log(`update order ${r({ order, body })} status to done`);

      if (order.transaction.status === 'done') {
        logger.log(`already done, skip.`);
        return undefined;
      }

      order.transaction.status = 'done';
      order.transaction.data = body;
      await order.transaction.save();
      order.status = 'done';
      await order.save();

      _.each(PaymentNotifyHelper.notifyHandlers, (handler) => handler(order));
      return order;
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
      logger.log(`validated alipay is ${r(validated)}`);
      if (!validated) {
        logger.error(`${body.subject} not validated. ${r(body)}`);
        throw new AsunaException(AsunaErrorCode.Unprocessable, `${body.subject} not validated.`);
      }

      const params = parseJSONIfCould(body.passback_params);
      logger.log(`find order ${params.orderId ?? body.subject}`);
      const order = await PaymentOrder.findOneOrFail(params.orderId ?? body.subject, { relations: ['transaction'] });
      logger.log(`update order ${r({ order, body })} status to done`);

      if (order.transaction.status === 'done') {
        logger.log(`already done, skip.`);
        return undefined;
      }

      order.transaction.status = 'done';
      order.transaction.data = body;
      await order.transaction.save();
      order.status = 'done';
      await order.save();

      _.each(PaymentNotifyHelper.notifyHandlers, (handler) => handler(order));
      return order;
    }

    // throw new AsunaException(AsunaErrorCode.Unprocessable, 'alipay or wxpay support only');
  }
}
