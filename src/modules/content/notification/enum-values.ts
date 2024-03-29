import _ from 'lodash';

import { StaticImplements } from '@danielwii/asuna-helper/dist/types';
import { CanRegEnumValue, EnumValueStatic, ValueOf } from '../../enum-values';

@StaticImplements<EnumValueStatic>()
export class NotificationEnumValue {
  static key = 'Notification';
  static types = { live_float: 'float', live_in: 'live_in', app_in: 'app_in' };

  static get keys(): string[] {
    return _.keys(NotificationEnumValue.types);
  }

  static get data(): { [key in keyof typeof NotificationEnumValue.types]: string } {
    return { live_float: 'live 浮动', live_in: 'live 进入', app_in: '进入 app' };
  }
}
export type NotificationType = ValueOf<typeof NotificationEnumValue.types>;
export enum NotificationEnum {
  live_float,
  live_in,
  app_in,
}

@StaticImplements<EnumValueStatic>()
export class NotificationUsageEnumValue extends CanRegEnumValue {
  static key = 'NotificationUsage';
  static types = {};
  static desc = {};

  static get keys(): string[] {
    return _.keys(NotificationUsageEnumValue.types);
  }

  static get data(): { [key in keyof typeof NotificationUsageEnumValue.types]: string } {
    return this.desc;
  }
}
export type NotificationUsageType = ValueOf<typeof NotificationUsageEnumValue.types>;
