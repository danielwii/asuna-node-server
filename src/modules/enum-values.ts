import * as _ from 'lodash';
import { StaticImplements } from './common';

export type ValueOf<T> = T[keyof T];

export interface EnumValueStatic<T = {}> {
  /**
   * 用于存储在 constants kv 中的 key
   */
  key: string;
  /**
   * 主要用于使用，SexEnumValue.types.male
   */
  types: T;
  /**
   * 判断枚举：@IsIn(SexEnumValue.keys)
   */
  keys: string[];
  /**
   * 在 MetaInfo 中可以这样使用：({ accessible: 'readonly', name: '性别', type: 'EnumFilter', enumData: SexEnumValue.data })
   */
  data: { [key in keyof T]: string };
}

@StaticImplements<EnumValueStatic>()
export class SexEnumValue {
  static key = 'Sex';
  static types = {
    male: 'male',
    female: 'female',
  };

  static get keys(): string[] {
    return _.keys(SexEnumValue.types);
  }

  static get data(): { [key in keyof typeof SexEnumValue.types]: string } {
    return { male: '男', female: '女' };
  }
}
export type SexType = ValueOf<typeof SexEnumValue.types>;
