import { Promise } from 'bluebird';
import { IsBoolean, IsOptional } from 'class-validator';

import { deserializeSafely } from '../common/helpers';
import { AsunaCollections, KvDef, KvHelper } from '../core/kv';

export class TenantConfig {
  @IsBoolean() @IsOptional() enabled?: boolean;

  constructor(o: TenantConfig) {
    Object.assign(this, deserializeSafely(TenantConfig, o));
  }
}

export enum TenantFieldKeys {
  enabled = 'enabled',
}

export class TenantHelper {
  static kvDef: KvDef = { collection: AsunaCollections.TENANT, key: 'config' };

  static async getConfig(): Promise<TenantConfig> {
    return new TenantConfig(await KvHelper.getConfigsByEnumKeys(this.kvDef, TenantFieldKeys));
  }
}
