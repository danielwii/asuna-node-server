import { AsunaCollections, KeyValuePair, KvDef, KvHelper } from '../kv';

export class MigrationsHelper {
  static readonly kvDef: KvDef = { collection: AsunaCollections.SYSTEM_MIGRATIONS, key: 'versions' };

  static async getVersion(key: string): Promise<number> {
    const kvPair = await KvHelper.get(this.kvDef.collection, this.kvDef.key, {
      name: '实体迁移信息',
      type: 'json',
      value: { [key]: 0 },
    });
    return kvPair?.value?.[key] || -1;
  }

  static async updateVersion(key: string, version: number): Promise<KeyValuePair> {
    const kvPair = await KvHelper.get(this.kvDef.collection, this.kvDef.key, {
      name: '实体迁移信息',
      type: 'json',
      value: { [key]: version },
    });
    kvPair.value[key] = version;
    return KvHelper.update(kvPair.id, kvPair.name, kvPair.type, kvPair.value);
  }
}
