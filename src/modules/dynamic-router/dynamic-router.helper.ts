import { Promise } from 'bluebird';

import { CacheManager } from '../cache';
import { deserializeSafely } from '../common/helpers';
import { AsunaCollections, KvDef, KvHelper } from '../core/kv';

export enum DynamicRouterFieldKeys {
  path = 'path',
  text = 'text',
  description = 'description',
}

export class DynamicRouterConfig {
  textRouter: { path?: string; text?: string }[];

  constructor(o: DynamicRouterConfig) {
    Object.assign(this, deserializeSafely(DynamicRouterConfig, o));
  }
}

export class DynamicRouterHelper {
  static kvDef: KvDef = { collection: AsunaCollections.SYSTEM_DYNAMIC_ROUTER, key: 'text' };

  static async getConfig(): Promise<DynamicRouterConfig> {
    return CacheManager.cacheable(
      this.kvDef,
      async () => new DynamicRouterConfig({ textRouter: (await KvHelper.get(this.kvDef))?.value?.values }),
      120,
    );
  }
}
