import { Promise } from 'bluebird';

import { LoggerFactory } from '../common/logger';
import { InMemoryDB } from './db';

const logger = LoggerFactory.getLogger('CacheWrapper');

interface CacheWrapperDoOptions<V> {
  prefix?: string;
  key: any;
  resolver: () => Promise<V>;
  expiresInSeconds?: number;
  strategy?: 'cache-only' | 'cache-first';
}

export class CacheWrapper {
  public static async do<V>(opts: CacheWrapperDoOptions<V>): Promise<V> {
    const { key, prefix, resolver, expiresInSeconds, strategy } = opts;
    return InMemoryDB.save({ prefix, key }, resolver, { expiresInSeconds, strategy });
  }

  public static async clear(opts: { prefix?: string; key: any }): Promise<void> {
    return InMemoryDB.clear(opts);
  }
}
