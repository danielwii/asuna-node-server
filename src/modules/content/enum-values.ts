import _ from 'lodash';

import { StaticImplements } from '../common';

import type { EnumValueStatic, ValueOf } from '../enum-values';

@StaticImplements<EnumValueStatic>()
export class FeedbackStatusEnumValue {
  static key = 'FeedbackStatus';
  static types = { submitted: 'submitted', replied: 'replied', resolved: 'resolved' };

  static get keys(): string[] {
    return _.keys(FeedbackStatusEnumValue.types);
  }

  static get data(): { [key in keyof typeof FeedbackStatusEnumValue.types]: string } {
    return { submitted: '已提交', replied: '已回复', resolved: '已解决' };
  }
}
export type FeedbackStatusType = ValueOf<typeof FeedbackStatusEnumValue.types>;

@StaticImplements<EnumValueStatic>()
export class FeedbackSenderEnumValue {
  static key = 'FeedbackSender';
  static types = { user: 'user', admin: 'admin' };

  static get keys(): string[] {
    return _.keys(FeedbackSenderEnumValue.types);
  }

  static get data(): { [key in keyof typeof FeedbackSenderEnumValue.types]: string } {
    return { user: '用户', admin: '管理员' };
  }
}
export type FeedbackSenderType = ValueOf<typeof FeedbackSenderEnumValue.types>;
