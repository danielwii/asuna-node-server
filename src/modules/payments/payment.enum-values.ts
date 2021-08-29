import _ from 'lodash';

import { StaticImplements } from '@danielwii/asuna-helper/dist/types';

import type { EnumValueStatic, ValueOf } from '../enum-values';

@StaticImplements<EnumValueStatic>()
export class PaymentMethodEnumValue {
  static key = 'PaymentMethod';
  static types = {
    third: 'third',
    alipay: 'alipay',
    wxpay: 'wxpay',
    // paypal: 'paypal',
  };

  static get keys(): string[] {
    return _.keys(PaymentMethodEnumValue.types);
  }

  static get data(): { [key in keyof typeof PaymentMethodEnumValue.types]: string } {
    return { third: '第三方', alipay: '支付宝', wxpay: '微信支付' /* paypal: 'PayPal' */ };
  }
}

export type PaymentMethodType = ValueOf<typeof PaymentMethodEnumValue.types>;
