import { LoggerFactory } from '@danielwii/asuna-helper/dist/logger/factory';
import { RedisConfigObject } from '@danielwii/asuna-helper/dist/providers/redis/config';
import { r } from '@danielwii/asuna-helper/dist/serializer';

import DataLoader from 'dataloader';
import Redis from 'ioredis';
import _ from 'lodash';
import * as fp from 'lodash/fp';
import { LRUMap } from 'lru_map';
import createRedisDataloader from 'redis-dataloader';
import { BaseEntity, FindOptionsWhere, In, ObjectType } from 'typeorm';

import { CacheManager } from '../cache';
import { CacheTTL } from '../cache/constants';
import { configLoader } from '../config';
import { DBHelper } from '../core/db';
import { PubSubChannels, PubSubHelper } from '../pub-sub/pub-sub.helper';

import type { GraphQLResolveInfo } from 'graphql';
import type { FieldNode } from 'graphql/language/ast';
import type { PrimaryKey } from '../common';
import type { DefaultRegisteredLoaders } from './context';

const logger = LoggerFactory.getLogger('DataLoader');

export interface DataLoaderFunction<Entity extends BaseEntity> {
  load: ((id?: PrimaryKey) => Promise<Entity>) & ((ids?: PrimaryKey[]) => Promise<Entity[]>);
}

function resolveIds(ids: PrimaryKey[], primaryKey: PrimaryKey) {
  return (entities) => ids.map((id) => entities.find((entity) => (entity ? entity[primaryKey] === id : false)));
}

function build<Entity extends BaseEntity>(dataloader: DataLoader<PrimaryKey, Entity>): DataLoaderFunction<Entity> {
  return {
    load(ids?: PrimaryKey | PrimaryKey[]) {
      if (_.isArray(ids)) {
        return !_.isEmpty(ids) ? (dataloader.loadMany(ids as PrimaryKey[]).then(fp.compact) as any) : null;
      }
      return ids ? dataloader.load(ids as PrimaryKey) : undefined;
    },
  };
}

export function loader<Entity extends BaseEntity>(
  entity: typeof BaseEntity,
  opts: { isPublished?: boolean; isDeleted?: boolean; loadRelationIds?: boolean } = {},
): DataLoaderFunction<Entity> {
  return build<Entity>(
    cachedDataLoader(entity.name, (ids) => {
      // logger.debug(`cachedDataLoader load ${entity.name}: ${ids}`);
      const primaryKey = DBHelper.getPrimaryKey(DBHelper.repo(entity));
      logger.verbose(`${entity} primaryKey is ${primaryKey}`);
      const options = {
        where: {
          [primaryKey]: In(ids),
          ...(_.has(opts, 'isPublished') ? { isPublished: opts.isPublished } : undefined),
          ...(_.has(opts, 'isDeleted') ? { isDeleted: opts.isDeleted } : undefined),
        } as FindOptionsWhere<any>,
        loadRelationIds: opts.loadRelationIds,
      };
      return entity.find(options).then(resolveIds(ids, primaryKey));
    }),
  );
}

export class DataloaderCleaner {
  public static redisLoaders: Record<string, any> = {};

  public static reg(segment: string, loader) {
    logger.log(`reg redis cleaner ${segment}`);
    DataloaderCleaner.redisLoaders[segment] = loader;
  }

  public static clear(segment: string, id: PrimaryKey): void {
    const key = `${segment}:${id}`;
    logger.log(`remove loader cache ... ${r(key)}`);
    if (DataloaderCleaner.redisLoaders[segment]) {
      const redisLoader = DataloaderCleaner.redisLoaders[segment];
      redisLoader.clear(id);
      redisLoader.clearLocal(id);
      redisLoader.clearAllLocal(id);
    } else {
      const cache = new CacheManager('dataloader');
      cache.clear({ prefix: 'dataloader', key });
    }
  }
}

export class GenericDataLoader<T extends DefaultRegisteredLoaders> {
  public static _loaders;

  public static loaders<Loaders = DefaultRegisteredLoaders>(): Loaders {
    return GenericDataLoader._loaders;
  }

  public initLoaders(loaders: T): void {
    logger.debug(`init loaders ${r(loaders)}`);
    GenericDataLoader._loaders = loaders;
  }

  public createLoaders(): T {
    return _.memoize(() => GenericDataLoader._loaders)();
  }
}

export function cachedDataLoader(segment: string, fn): DataLoader<PrimaryKey, any> {
  const redisConfig = RedisConfigObject.loadOr('dataloader');
  const enableRedisDataLoader = configLoader.loadBoolConfig('DATALOADER_REDIS_CACHE', true);
  // const redis = RedisProvider.getRedisClient('dataloader');
  if (redisConfig.enable && enableRedisDataLoader) {
    logger.log(`init redis dataloader for ${segment} ... ${r(redisConfig.host)}`);
    const redis = new Redis(redisConfig.getIoOptions());
    redis.on('error', (reason) => {
      logger.error(`ioredis connection error ${r(reason)}`);
    });
    const redisLoader = new (createRedisDataloader({ redis }))(
      `dataloader-${segment}`,
      // create a regular dataloader. This should always be set with caching disabled.
      new DataLoader(
        (ids) => {
          logger.debug(`redis dataloader load ${segment}: ${ids}`);
          return fn(ids);
        },
        { batchScheduleFn: (callback) => setTimeout(callback, 20), cache: false },
      ),
      {
        // caching here is a local in memory cache. Caching is always done to redis.
        cache: true,
        // if set redis keys will be set to expire after this many seconds
        // this may be useful as a fallback for a redis cache.
        expire: 60 * 2,
        // can include a custom serialization and deserialization for storage in redis.
        serialize: (o) => JSON.stringify(o) || '',
        deserialize: (s) => JSON.parse(s),
      },
    );
    DataloaderCleaner.reg(segment, redisLoader);
    return redisLoader;
  }

  const cache = new CacheManager('dataloader');
  return new DataLoader(
    (ids) => {
      logger.debug(`dataloader load ${segment}: ${ids}`);
      return fn(ids);
    },
    {
      batchScheduleFn: (callback) => setTimeout(callback, 20),
      cacheMap: {
        get: (id: string) => {
          const key = `${segment}:${id}`;
          const ttl = cache.getRemainingTTL({ prefix: 'dataloader', key });
          const value = cache.get({ prefix: 'dataloader', key });
          logger.verbose(`get (${key}) ${r({ exists: !!value, ttl: parseInt(String(ttl / 1000)) })}`);
          return value;
        },
        set: async (id: string, value) => {
          const key = `${segment}:${id}`;
          const promised = await value;
          if (promised) {
            logger.verbose(`dataloader set ${key}`);
            const result = cache.set({ prefix: 'dataloader', key }, promised, CacheTTL.FLASH / 1000);
            logger.debug(`set (${key}) size ${result.size}/${result.max}/${result.maxSize}`);
          }
        },
        delete: (id: string) => {
          const key = `${segment}:${id}`;
          cache.clear({ prefix: 'dataloader', key });
          PubSubHelper.publish(PubSubChannels.dataloader, { action: 'delete', payload: key }).catch((reason) =>
            logger.error(reason),
          );
        },
        clear: () => {
          logger.log(`clear (${segment})`);
          cache.clearAll();
          PubSubHelper.publish(PubSubChannels.dataloader, { action: 'clear' }).catch((reason) => logger.error(reason));
        },
      },
    },
  );
}

export function cachedPerRequestDataLoader(segment: string, fn): DataLoader<PrimaryKey, any> {
  return new DataLoader(
    (ids) => {
      logger.debug(`per-request dataloader load ${segment}: ${ids}`);
      return fn(ids);
    },
    { batchScheduleFn: (callback) => setTimeout(callback, 20), cacheMap: new LRUMap(100) },
  );
}

/**
 * 解析出 graphql 参数中的关联字段
 */
export function resolveRelationsFromInfo(
  info: GraphQLResolveInfo,
  path: string,
): boolean | { relations?: string[]; disableMixedMap?: boolean } {
  if (!info || !path) return false;

  try {
    const locations = path.split('.');
    const fieldNode = info.fieldNodes.find((node) => node.name.value === locations[0]);
    if (_.isNil(fieldNode)) return false;

    let selectionNode; // like items node
    _.times(locations.length - 1).forEach((index) => {
      (selectionNode || fieldNode).selectionSet.selections.find((node) => {
        if (node.kind === 'FragmentSpread') {
          selectionNode = info.fragments[node.name.value].selectionSet.selections.find(
            (fragmentNode: any) => fragmentNode.name.value === locations[index + 1],
          );
          return;
        }
        if (node.name.value === locations[index + 1]) {
          selectionNode = node;
          return;
        }
      });
    });
    const relations = _.uniq<string>(
      (selectionNode || fieldNode).selectionSet.selections
        .filter((node) => node.selectionSet)
        .map((node) => node.name.value),
    );
    logger.debug(`resolved relations ${r({ path, locations, relations })}`);
    return { relations };
  } catch (error) {
    logger.warn(`resolveRelationsFromInfo ${r(error)}`);
    return false;
  }
}

export function resolveFieldsFromInfo(info: GraphQLResolveInfo, path: string): string[] {
  if (!info || !path) return [];

  try {
    const locations = path.split('.');
    const fieldNode = info.fieldNodes.find((node) => node.name.value === locations[0]);
    if (_.isNil(fieldNode)) return [];

    let selectionNode; // like items node
    _.times(locations.length - 1).forEach((index) => {
      (selectionNode || fieldNode).selectionSet.selections.find((node) => {
        if (node.kind === 'FragmentSpread') {
          selectionNode = info.fragments[node.name.value].selectionSet.selections.find(
            (fragmentNode: any) => fragmentNode.name.value === locations[index + 1],
          );
          return;
        }
        if (node.name.value === locations[index + 1]) {
          selectionNode = node;
          return;
        }
      });
    });
    const fields = _.uniq<string>(
      (selectionNode || fieldNode).selectionSet.selections
        // .filter((node) => node.selectionSet)
        .map((node) => node.name.value),
    );
    logger.debug(`resolved relations ${r({ path, locations, fields })}`);
    return fields;
  } catch (error) {
    logger.warn(`resolveRelationsFromInfo ${r(error)}`);
    return [];
  }
}

// TODO cannot resolve fragments
export function resolveSelectsFromInfo(info: GraphQLResolveInfo, path: string): string[] | null {
  if (!info || !path) return null;

  try {
    const locations = path.split('.');
    const fieldNode = info.fieldNodes.find((node) => node.name.value === locations[0]);

    if (_.isNil(fieldNode)) return null;

    let selectionNode;
    _.times(locations.length - 1).forEach((index) => {
      selectionNode = (selectionNode || fieldNode).selectionSet.selections.find(
        (node) => (node as any).name.value === locations[index + 1],
      );
    });
    const selects = ((selectionNode || fieldNode).selectionSet.selections as FieldNode[])
      .filter((node) => !node.selectionSet)
      .map((node) => node.name.value);
    logger.debug(`resolved selects ${r({ path, selects })}`);
    return selects;
  } catch (error) {
    logger.warn(`resolveRelationsFromInfo ${r(error)}`);
    return null;
  }
}
export const resolveFieldsByPagedMixInfo = <Entity>(entity: ObjectType<Entity>, info: GraphQLResolveInfo) => ({
  mixedFields: resolveSelectsFromInfo(info, `${info.fieldName}.items`),
  relations: resolveRelationsFromInfo(info, `${info.fieldName}.items`),
  select: DBHelper.filterSelect(entity, resolveSelectsFromInfo(info, `${info.fieldName}.items.origin`)),
});
export const resolveFieldsByPagedInfo = <Entity>(entity: ObjectType<Entity>, info: GraphQLResolveInfo) => ({
  // mixedFields: resolveSelectsFromInfo(info, `${path}.items`),
  relations: resolveRelationsFromInfo(info, `${info.fieldName}.items`),
  select: DBHelper.filterSelect(entity, resolveSelectsFromInfo(info, `${info.fieldName}.items`)),
});
