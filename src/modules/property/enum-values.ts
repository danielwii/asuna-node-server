import * as _ from 'lodash';
import { StaticImplements } from '../common';
import { CanRegEnumValue, EnumValueStatic, ValueOf } from '../enum-values';

@StaticImplements<EnumValueStatic>()
export class ExchangeCurrencyEnumValue {
  static key = 'ExchangeCurrency';
  static types = { points: 'points', balance: 'balance' };

  static get keys(): string[] {
    return _.keys(ExchangeCurrencyEnumValue.types);
  }

  static get data(): { [key in keyof typeof ExchangeCurrencyEnumValue.types]: string } {
    return { points: '积分', balance: '余额' };
  }
}
export type ExchangeCurrencyType = ValueOf<typeof ExchangeCurrencyEnumValue.types>;

@StaticImplements<EnumValueStatic>()
export class ExchangeObjectUsageEnumValue extends CanRegEnumValue {
  static key = 'ExchangeObjectUsage';
  static types = {};
  static desc = {};

  static get keys(): string[] {
    return _.keys(ExchangeObjectUsageEnumValue.types);
  }

  static get data(): { [key in keyof typeof ExchangeObjectUsageEnumValue.types]: string } {
    return this.desc;
  }
}
export type ExchangeObjectUsageType = ValueOf<typeof ExchangeObjectUsageEnumValue.types>;
