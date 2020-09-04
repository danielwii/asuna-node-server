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

export abstract class CanRegEnumValue {
  public static reg(key: string, value?: string, desc?: string) {
    _.set(_.get(this, 'types'), key, value ?? key);
    _.set(_.get(this, 'desc'), key, desc ?? value ?? key);
  }
}

@StaticImplements<EnumValueStatic>()
export class SexEnumValue {
  public static key = 'Sex';
  public static types = {
    male: 'male',
    female: 'female',
  };

  public static get keys(): string[] {
    return _.keys(SexEnumValue.types);
  }

  public static get data(): { [key in keyof typeof SexEnumValue.types]: string } {
    return { male: '男', female: '女' };
  }
}
export type SexType = ValueOf<typeof SexEnumValue.types>;
