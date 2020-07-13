import * as _ from 'lodash';
import { CanRegEnumValue, EnumValueStatic, ValueOf } from '../../enum-values';
import { StaticImplements } from '../../common';

@StaticImplements<EnumValueStatic>()
export class NotificationEnumValue {
  static key = 'Notification';
  static types = { float: 'float', system: 'system' };

  static get keys(): string[] {
    return _.keys(NotificationEnumValue.types);
  }

  static get data(): { [key in keyof typeof NotificationEnumValue.types]: string } {
    return { float: '浮动', system: '系统' };
  }
}
export type NotificationType = ValueOf<typeof NotificationEnumValue.types>;

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
