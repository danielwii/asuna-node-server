import { StaticImplements } from '@danielwii/asuna-helper/dist/types';

import _ from 'lodash';

import { CanRegEnumValue, EnumValueStatic, ValueOf } from '../enum-values';

@StaticImplements<EnumValueStatic>()
export class ExchangeCurrencyEnumValue {
  public static key = 'ExchangeCurrency';
  public static types = { Points: 'Points', Balance: 'Balance' };

  public static get keys(): string[] {
    return _.keys(ExchangeCurrencyEnumValue.types);
  }

  public static get data(): { [key in keyof typeof ExchangeCurrencyEnumValue.types]: string } {
    return { Points: '积分', Balance: '余额' };
  }
}
export type ExchangeCurrencyType = ValueOf<typeof ExchangeCurrencyEnumValue.types>;
export enum ExchangeCurrencyEnum {
  Points = 'Points',
  Balance = 'Balance',
}

@StaticImplements<EnumValueStatic>()
export class ExchangeObjectUsageEnumValue extends CanRegEnumValue {
  public static key = 'ExchangeObjectUsage';
  public static types = {};
  public static desc = {};

  public static get keys(): string[] {
    return _.keys(ExchangeObjectUsageEnumValue.types);
  }

  public static get data(): { [key in keyof typeof ExchangeObjectUsageEnumValue.types]: string } {
    return this.desc;
  }
}
export type ExchangeObjectUsageType = ValueOf<typeof ExchangeObjectUsageEnumValue.types>;
