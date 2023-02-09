import { Injectable } from '@nestjs/common';

import { deserializeSafely } from '@danielwii/asuna-helper/dist/validate';

import { CacheManager } from '../cache';
import { AsunaCollections, KvDef, KvService } from '../core/kv/kv.service';

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

@Injectable()
export class DynamicRouterService {
  kvDef: KvDef = { collection: AsunaCollections.SYSTEM_DYNAMIC_ROUTER, key: 'text' };

  constructor(private readonly kvService: KvService) {}

  async getConfig(): Promise<DynamicRouterConfig> {
    return CacheManager.default.cacheable(
      this.kvDef,
      async () => new DynamicRouterConfig({ textRouter: (await this.kvService.get(this.kvDef))?.value?.values }),
      120,
    );
  }
}
