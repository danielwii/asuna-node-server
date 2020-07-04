import * as _ from 'lodash';
import { EnumValueStatic, CanRegEnumValue, ValueOf } from '../../enum-values';
import { StaticImplements } from '../../common/types';

@StaticImplements<EnumValueStatic>()
export class InteractionFollowEnumValue extends CanRegEnumValue {
  static key = 'InteractionFollow';
  static types = { user: 'user' };
  static desc: { [key in keyof typeof InteractionFollowEnumValue.types]: string } = { user: '用户' };

  static get keys(): string[] {
    return _.keys(InteractionFollowEnumValue.types);
  }

  static get data(): { [key in keyof typeof InteractionFollowEnumValue.types]: string } {
    return this.desc;
  }
}
export type InteractionFollowType = ValueOf<typeof InteractionFollowEnumValue.types>;
