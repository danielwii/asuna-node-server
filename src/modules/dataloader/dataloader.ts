import { Promise } from 'bluebird';
import * as DataLoader from 'dataloader';
import { GraphQLResolveInfo } from 'graphql';
import { FieldNode } from 'graphql/language/ast';
import * as _ from 'lodash';
import * as fp from 'lodash/fp';
import { LRUMap } from 'lru_map';
import { BaseEntity } from 'typeorm';
import { CacheTTL } from '../cache/constants';
import { PrimaryKey } from '../common';
import { r } from '../common/helpers';
import { LoggerFactory } from '../common/logger';
import { DBHelper } from '../core/db';
import { PubSubChannels, PubSubHelper } from '../pub-sub/pub-sub.helper';

const logger = LoggerFactory.getLogger('DataLoader');

const cacheMap = new Map();

export interface DataLoaderFunction<Entity extends BaseEntity> {
  load(id?: PrimaryKey): Promise<Entity>;
  load(ids?: PrimaryKey[]): Promise<Entity[]>;
}

function resolveIds(ids: PrimaryKey[], primaryKey: PrimaryKey) {
  return entities => ids.map(id => entities.find(entity => (entity ? entity[primaryKey] === id : false)));
}

function build<Entity extends BaseEntity>(dataloader: DataLoader<PrimaryKey, Entity>): DataLoaderFunction<Entity> {
  return {
    load(ids?: PrimaryKey | PrimaryKey[]) {
      if (_.isArray(ids)) {
        return !_.isEmpty(ids) ? (dataloader.loadMany(ids as PrimaryKey[]).then(fp.compact) as any) : null;
      }
      return ids ? dataloader.load(ids as PrimaryKey) : null;
    },
  };
}

export function loader<Entity extends BaseEntity>(
  entity: typeof BaseEntity,
  opts: { isPublished?: boolean; loadRelationIds?: boolean } = {},
): DataLoaderFunction<Entity> {
  return build<Entity>(
    cachedDataLoader(entity.name, ids => {
      const primaryKey = DBHelper.getPrimaryKey(DBHelper.repo(entity));
      return entity
        .findByIds(ids, {
          where: { isPublished: opts.isPublished },
          loadRelationIds: opts.loadRelationIds,
        })
        .then(resolveIds(ids, primaryKey));
    }),
  );
}

export const dataLoaderCleaner = {
  clear(segment, id): void {
    logger.verbose(`remove loader cache ... ${segment}-${id}`);
    cacheMap.delete(`${segment}-${id}`);
  },
};

export class GenericDataLoader {
  private static loaders;

  constructor() {
    logger.log('init ...');
  }

  initLoaders(loaders: { [key: string]: DataLoaderFunction<any> }): void {
    GenericDataLoader.loaders = loaders;
  }

  createLoaders(): { [key: string]: DataLoaderFunction<any> } {
    return _.memoize(() => GenericDataLoader.loaders)();
  }
}

export function cachedDataLoader(segment: string, fn): DataLoader<PrimaryKey, any> {
  /* dataloader is a internal cache, not support distributed
  const redis = RedisProvider.instance.getRedisClient('dataloader');
  if (redis.isEnabled) {
    return new DataLoader(
      ids => {
        logger.log(`dataloader load ${segment}: ${ids}`);
        return fn(ids);
      },
      {
        batchScheduleFn: callback => setTimeout(callback, 100),
        cacheMap: {
          get: (id: PrimaryKey) => {
            const key = `${segment}-${id}`;
            const exists = redis.client.EXISTS(key);
            logger.verbose(`dataloader exists ${key} ${exists}`);
            if (!exists) return; // Not cached. Sorry.
            // eslint-disable-next-line no-async-promise-executor
            return new Promise(async resolve => {
              const entry = await promisify(redis.client.GET, redis.client)(key);
              logger.verbose(`dataloader get ${key} ${r(entry)}`);
              if (!entry) {
                promisify(redis.client.DEL, redis.client)(key);
                const reload = await fn([id]).catch(reason => logger.error(reason));
                logger.verbose(`dataloader reload ${key} ${r(reload)}`);
                resolve(reload);
              } else {
                resolve(entry);
              }
            });
          },
          set: async (id: PrimaryKey, value: Promise<any>) => {
            const key = `${segment}-${id}`;
            const entry = await value;
            logger.verbose(`dataloader set ${key}`);
            Promise.promisify(redis.client.SET).bind(redis.client)(key, entry);
          },
          delete(id: PrimaryKey): void {
            const key = `${segment}-${id}`;
            logger.log(`dataloader delete $key`);
            promisify(redis.client.DEL, redis.client)(key);
          },
          clear(): void {
            logger.log(`dataloader clear (${segment})`);
            Promise.promisify(redis.client.FLUSHDB).bind(redis.client)();
          },
        },
      },
    );
  }
*/
  return new DataLoader(
    ids => {
      logger.verbose(`dataloader load ${segment}: ${ids}`);
      return fn(ids);
    },
    {
      batchScheduleFn: callback => setTimeout(callback, 10),
      cacheMap: {
        get: (id: string) => {
          // const cachedObject = await client.get({ segment, id });
          // logger.log(`get (${segment}:${id}) ${r(cachedObject)}`);
          // return cachedObject;
          const now = Date.now();
          const key = `${segment}-${id}`;
          const { value, expires } = cacheMap.get(key) || ({} as any);
          logger.debug(
            `get (${segment}:${id}) ${r({
              exists: !!value,
              expires: new Date(expires),
              now: new Date(now),
              left: expires - now,
              isExpired: expires < now,
            })}`,
          );
          if (!value) {
            return null;
          }
          const isExpired = expires < now;
          if (isExpired) {
            cacheMap.delete(key);
            return null;
          }
          return value;
        },
        set: async (id: string, value) => {
          const key = `${segment}-${id}`;
          const promised = await value;
          if (promised) {
            logger.verbose(`dataloader set ${key}`);
            const now = Date.now();
            // logger.log(`has (${segment}:${id})[${cacheMap.size}]${cacheMap.has(key)}`);
            // if (!cacheMap.has(key)) {
            //   cacheMap.set(key, { value, expires: now + 1 * 60 * 1000 });
            //   // console.log({ size: cacheMap.size });
            // }
            cacheMap.set(key, { value: promised, expires: now + CacheTTL.SHORT });
          }
        },
        delete: (id: string) => {
          logger.log(`delete (${segment}:${id})`);
          const key = `${segment}-${id}`;
          cacheMap.delete(key);
          PubSubHelper.publish(PubSubChannels.dataloader, { action: 'delete', payload: key }).catch(reason =>
            logger.error(reason),
          );
          // return client.drop({ segment, id });
        },
        clear: () => {
          // logger.log(`clear (${segment})`);
          cacheMap.clear();
          PubSubHelper.publish(PubSubChannels.dataloader, { action: 'clear' }).catch(reason => logger.error(reason));
          // return logger.warn('not implemented.');
        },
      },
    },
  );
}

export function cachedPerRequestDataLoader(segment: string, fn): DataLoader<PrimaryKey, any> {
  return new DataLoader(
    ids => {
      logger.verbose(`per-request dataloader load ${segment}: ${ids}`);
      return fn(ids);
    },
    { batchScheduleFn: callback => setTimeout(callback, 10), cacheMap: new LRUMap(100) },
  );
}

/**
 * 解析出 graphql 参数中的关联字段
 * @param info
 * @param path
 */
export function resolveRelationsFromInfo(
  info: GraphQLResolveInfo,
  path: string,
): boolean | { relations?: string[]; disableMixedMap?: boolean } {
  if (!info || !path) return false;

  try {
    const locations = path.split('.');
    const fieldNode = info.fieldNodes.find(node => node.name.value === locations[0]);
    if (fieldNode == null) return false;

    let selectionNode;
    _.times(locations.length - 1).forEach(index => {
      selectionNode = (selectionNode || fieldNode).selectionSet.selections.find(
        node => (node as any).name.value === locations[index + 1],
      );
    });
    const relations = ((selectionNode || fieldNode).selectionSet.selections as FieldNode[])
      .filter(node => node.selectionSet)
      .map(node => node.name.value);
    logger.verbose(`resolved relations ${r({ path, relations })}`);
    return { relations };
  } catch (error) {
    logger.warn(`resolveRelationsFromInfo ${r(error)}`);
    return false;
  }
}

export function resolveSelectsFromInfo(info: GraphQLResolveInfo, path: string): string[] | null {
  if (!info || !path) return null;

  try {
    const locations = path.split('.');
    const fieldNode = info.fieldNodes.find(node => node.name.value === locations[0]);

    if (fieldNode == null) return null;

    let selectionNode;
    _.times(locations.length - 1).forEach(index => {
      selectionNode = (selectionNode || fieldNode).selectionSet.selections.find(
        node => (node as any).name.value === locations[index + 1],
      );
    });
    const selects = ((selectionNode || fieldNode).selectionSet.selections as FieldNode[])
      .filter(node => !node.selectionSet)
      .map(node => node.name.value);
    logger.verbose(`resolved selects ${r({ path, selects })}`);
    return selects;
  } catch (error) {
    logger.warn(`resolveRelationsFromInfo ${r(error)}`);
    return null;
  }
}

export function resolveFieldsByPagedMixInfo(info: GraphQLResolveInfo, path: string) {
  return {
    mixedFields: resolveSelectsFromInfo(info, `${path}.items`),
    relations: resolveRelationsFromInfo(info, `${path}.items`),
    select: resolveSelectsFromInfo(info, `${path}.items.origin`),
  };
}
