import { ColumnType, WithPrecisionColumnType } from 'typeorm/driver/types/ColumnTypes';
import { ColumnNumericOptions } from 'typeorm/decorator/options/ColumnNumericOptions';
import { Global } from '../global';

export class ColumnTypeHelper {
  static readonly MONEY: WithPrecisionColumnType = 'double precision';

  // usage: @Column({ ...ColumnTypeHelper.money(), nullable: false, default: 0 })
  static money(
    options: ColumnNumericOptions = { precision: 15, scale: 2 },
  ): ColumnNumericOptions & { type: ColumnType } {
    return { type: 'decimal', ...options };
  }

  static get JSON(): 'simple-json' | 'json' | 'jsonb' {
    const { dbType } = Global;
    if (['mysql57', 'mysql8', 'mariadb'].includes(dbType)) {
      return 'json';
    }
    if (dbType === 'postgres') {
      return 'jsonb';
    }
    return 'simple-json';
  }

  static text(type: 'text' | 'mediumtext' | 'longtext' = 'text'): 'text' | 'mediumtext' | 'longtext' {
    const { dbType } = Global;
    return dbType === 'sqlite' ? 'text' : type;
  }
}
