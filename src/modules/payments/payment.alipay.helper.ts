import AlipaySdk from 'alipay-sdk';
import { AlipaySdkCommonResult } from 'alipay-sdk/lib/alipay';
import { LoggerFactory } from '../common/logger';
import { r } from '../common/helpers/utils';

const logger = LoggerFactory.getLogger('PaymentAlipayHelper');

export class PaymentAlipayHelper {
  static async init({
    appId,
    privateKey,
  }: {
    appId: string;
    privateKey: string;
  }): Promise<AlipaySdkCommonResult | string> {
    const alipaySdk = new AlipaySdk({ appId, privateKey });

    const result = await alipaySdk.exec('alipay.system.oauth.token', {
      grantType: 'authorization_code',
      code: 'code',
      refreshToken: 'token',
    });
    logger.log(`init [alipay.system.oauth.token] result is ${r(result)}`);
    return result;
  }
}
