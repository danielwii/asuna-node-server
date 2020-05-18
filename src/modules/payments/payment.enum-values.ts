import * as _ from 'lodash';
import { StaticImplements } from '../common';
import { EnumValueStatic, ValueOf } from '../enum-values';

@StaticImplements<EnumValueStatic>()
export class PaymentMethodEnumValue {
  static key = 'PaymentMethod';
  static types = {
    third: 'third',
    alipay: 'alipay',
    // paypal: 'paypal',
  };

  static get keys(): string[] {
    return _.keys(PaymentMethodEnumValue.types);
  }

  static get data(): { [key in keyof typeof PaymentMethodEnumValue.types]: string } {
    return { third: '第三方', alipay: '支付宝' /* paypal: 'PayPal' */ };
  }
}

export type PaymentMethodType = ValueOf<typeof PaymentMethodEnumValue.types>;
