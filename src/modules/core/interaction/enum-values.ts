import _ from 'lodash';

import { StaticImplements } from '../../common/types';
import { CanRegEnumValue, EnumValueStatic, ValueOf } from '../../enum-values';

@StaticImplements<EnumValueStatic>()
export class InteractionFollowEnumValue extends CanRegEnumValue {
  static key = 'InteractionFollow';
  static types = { user: 'user', profile: 'profile' };
  static desc: { [key in keyof typeof InteractionFollowEnumValue.types]: string } = {
    user: '用户',
    profile: 'Profile',
  };

  static get keys(): string[] {
    return _.keys(InteractionFollowEnumValue.types);
  }

  static get data(): { [key in keyof typeof InteractionFollowEnumValue.types]: string } {
    return this.desc;
  }
}
export type InteractionFollowType = ValueOf<typeof InteractionFollowEnumValue.types>;
