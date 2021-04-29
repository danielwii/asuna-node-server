import { AsunaErrorCode, AsunaException } from '@danielwii/asuna-helper/dist/exceptions';
import { LoggerFactory } from '@danielwii/asuna-helper/dist/logger';
import { r } from '@danielwii/asuna-helper/dist/serializer';
import { parseJSONIfCould } from '@danielwii/asuna-helper/dist/utils';

import AlipaySdk, { AlipaySdkCommonResult, AlipaySdkConfig } from 'alipay-sdk/lib/alipay';
import AlipayFormData from 'alipay-sdk/lib/form';
import _ from 'lodash';

import { AppConfigObject } from '../config/app.config';
import { PaymentMethod } from './payment.entities';
import { PaymentMethodEnumValue } from './payment.enum-values';

const logger = LoggerFactory.getLogger('PaymentAlipayHelper');

export class PaymentAlipayHelper {
  public static async sdk(): Promise<AlipaySdk> {
    const method = await PaymentMethod.findOne({ type: PaymentMethodEnumValue.types.alipay, isPublished: true });
    if (!method) {
      throw new AsunaException(AsunaErrorCode.Unprocessable, `no alipay method exists`);
    }
    const config: AlipaySdkConfig = {
      appId: method.merchant,
      privateKey: method.privateKey,
      alipayPublicKey: _.get(method.extra, 'alipayPublicKey') as string,
    };
    // logger.debug(`alipay config is ${r(config)}`);
    return new AlipaySdk(config);
  }

  public static async authToken(): Promise<AlipaySdkCommonResult | string> {
    const sdk = await PaymentAlipayHelper.sdk();
    logger.debug(`alipay sdk is ${r(sdk)}`);

    const result = await sdk
      .exec('alipay.system.oauth.token', {
        grantType: 'authorization_code',
        code: 'code',
        refreshToken: 'token',
      })
      .catch((reason) => {
        logger.error(
          `authorized code error ${r(reason)} data: ${r(parseJSONIfCould(_.get(reason, 'serverResult.data')))}`,
        );
        throw reason;
      });

    logger.log(`[alipay.system.oauth.token] result is ${r(result)}`);
    return result;
  }

  public static async createPaymentOrder(
    method: PaymentMethod,
    goods: { cost: number; name: string; packParams: object },
    { returnUrl, isMobile }: { returnUrl?: string; isMobile?: boolean },
  ): Promise<AlipaySdkCommonResult | string> {
    logger.debug(`create payment order ${r({ method, goods, returnUrl })}`);
    // const token = await this.authToken();

    const sdk = await PaymentAlipayHelper.sdk();

    const execMethod = isMobile ? 'alipay.trade.wap.pay' : 'alipay.trade.page.pay'; // 统一收单下单并支付页面接口
    // 公共参数 可根据业务需要决定是否传入，当前不用
    // const params = {
    //     app_id: '2016101000654289', // 应用 id
    //     method: method, // 调用接口
    //     format: 'JSON', // 返回数据
    //     charset: 'utf-8', // 字符编码
    //     sign_type: 'RSA2', // 验签类型
    //     timestamp: getFormatDate(), // 请求时间戳
    //     version: '1.0', // 版本
    // }
    // 根据官方给的 API 文档提供的一个参数集合
    const bizContent = {
      out_trade_no: Date.now(), // 根据时间戳来生成一个订单号,
      product_code: 'FAST_INSTANT_TRADE_PAY', // 商品码，当前只支持这个
      total_amount: goods.cost, // 商品价格
      subject: goods.name, // 商品名称
      timeout_express: '5m', // 超时时间
      passback_params: JSON.stringify(goods.packParams), // 将会返回的一个参数，可用于自定义商品信息最后做通知使用
    };

    const MASTER_HOST = AppConfigObject.load().masterAddress;
    const formData = new AlipayFormData(); // 获取一个实例化对象
    formData.addField('returnUrl', returnUrl || `${MASTER_HOST}/api/v1/payment/callback`); // 客户端支付成功后会同步跳回的地址
    // 支付宝在用户支付成功后会异步通知的回调地址，必须在公网 IP 上才能收到
    if (_.get(method.extra, 'notifyUrl')) formData.addField('notifyUrl', _.get(method.extra, 'notifyUrl'));
    else if (!_.isEmpty(MASTER_HOST?.trim())) formData.addField('notifyUrl', `${MASTER_HOST}/api/v1/payment/notify`);
    else throw new AsunaException(AsunaErrorCode.Unprocessable, 'no notify url defined.');
    formData.addField('bizContent', bizContent); // 将必要的参数集合添加进 form 表单

    logger.debug(`exec ${execMethod} ${r(formData)}`);
    // 异步向支付宝发送生成订单请求, 第二个参数为公共参数，不需要的话传入空对象就行
    const result = await sdk.exec(execMethod, {}, { formData });
    logger.debug(`result is ${r(result)}`);
    // 返回订单的结果信息
    return result;
  }

  public static async validateSign(postData: object): Promise<boolean> {
    const sdk = await this.sdk();

    return sdk.checkNotifySign(postData);
  }
}
