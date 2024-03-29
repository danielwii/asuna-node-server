import { CacheKey, InMemoryDB } from './db';

import type { GraphQLResolveCacheInfo, GraphqlContext } from '../dataloader/dataloader.interceptor';

interface CacheWrapperDoOptions<V> {
  prefix?: string;
  key: string | CacheKey;
  resolver: () => Promise<V>;
  expiresInSeconds?: number;
  strategy?: 'cache-only' | 'cache-first';
}

export class CacheWrapper {
  public static async do<V>(opts: CacheWrapperDoOptions<V>): Promise<V> {
    const { key, prefix, resolver, expiresInSeconds, strategy } = opts;
    return InMemoryDB.save({ prefix, key }, resolver, { expiresInSeconds, strategy });
  }

  public static async clear(opts: { prefix?: string; key: any }): Promise<number | boolean> {
    return InMemoryDB.clear(opts);
  }

  public static scope<V>(
    info: GraphQLResolveCacheInfo,
    ctx: GraphqlContext,
    key: Record<'key' | 'id', any>,
    resolver: () => Promise<V>,
  ): Promise<V> {
    const hint = info.cacheControl.cacheHint;
    const scope = hint.scope === 'PRIVATE' ? ctx.getPayload().id : 'PUBLIC';
    return CacheWrapper.do({
      prefix: 'resolver:cache',
      key: { key, prefix: scope },
      resolver,
      expiresInSeconds: hint.maxAge,
    });
  }
}
