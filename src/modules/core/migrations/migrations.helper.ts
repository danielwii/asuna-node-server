import { AsunaCollections, KeyValuePair, KeyValueType, KvDef } from '../kv';
import { KvService } from '../kv/kv.service';

import type { NestExpressApplication } from '@nestjs/platform-express';

export class MigrationsHelper {
  static readonly kvDef: KvDef = { collection: AsunaCollections.SYSTEM_MIGRATIONS, key: 'versions' };

  static async getVersion(app: NestExpressApplication, key: string): Promise<number> {
    const kvService = app.get<KvService>(KvService);
    const kvPair = await kvService.get(this.kvDef, {
      name: '实体迁移信息',
      type: KeyValueType.json,
      value: { [key]: 0 },
    });
    return kvPair?.value?.[key] || -1;
  }

  static async updateVersion(app: NestExpressApplication, key: string, version: number): Promise<KeyValuePair> {
    const kvService = app.get<KvService>(KvService);
    const kvPair = await kvService.get(this.kvDef, {
      name: '实体迁移信息',
      type: KeyValueType.json,
      value: { [key]: version },
    });
    kvPair.value[key] = version;
    return kvService.update(kvPair.id, kvPair.name, kvPair.type, kvPair.value);
  }
}
