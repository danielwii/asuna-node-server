import * as DataLoader from 'dataloader';
import { GraphQLResolveInfo } from 'graphql';
import * as _ from 'lodash';
import * as fp from 'lodash/fp';
import { BaseEntity } from 'typeorm';
import { r } from '../common/helpers';
import { LoggerFactory } from '../common/logger';
import { Hermes, IAsunaEvent } from '../core/bus';

const logger = LoggerFactory.getLogger('DataLoaderCache');

const cacheMap = new Map();

type PrimaryKeyType = string | number;

export interface DataLoaderFunction<Entity extends BaseEntity> {
  load: (ids: PrimaryKeyType | PrimaryKeyType[]) => Entity[];
}

function resolve(ids) {
  return entities => {
    return ids.map(id => entities.find(entity => (entity ? entity.id === id : false)));
  };
}

function build<Entity extends BaseEntity>(loader): DataLoaderFunction<Entity> {
  return {
    load(ids: PrimaryKeyType | PrimaryKeyType[]) {
      if (_.isArray(ids)) {
        return !_.isEmpty(ids) ? loader.loadMany(ids).then(fp.compact) : null;
      }
      return ids ? loader.load(ids) : null;
    },
  };
}

export function loader<RegisteredLoaders>(
  name: keyof RegisteredLoaders,
  entity: typeof BaseEntity,
  opts: {
    isPublished?: boolean;
    loadRelationIds?: boolean;
  } = {},
): DataLoaderFunction<typeof entity & any> {
  return build<typeof entity & any>(
    cachedDataLoader(name, ids =>
      entity
        .findByIds(ids, {
          where: { isPublished: opts.isPublished },
          loadRelationIds: opts.loadRelationIds,
        })
        .then(resolve(ids)),
    ),
  );
}

export const dataLoaderCleaner = {
  clear(segment, id) {
    logger.log(`remove loader cache ... ${segment}-${id}`);
    cacheMap.delete(`${segment}-${id}`);
  },
};

/*
export function createDataLoaderProxy(preloader?: () => any | Promise<any>) {
  return {
    clear(segment, id) {
      logger.log(`remove ... ${segment}-${id}`);
      cacheMap.delete(`${segment}-${id}`);
    },
    async preload() {
      return preloader ? preloader() : Promise.resolve();
    },
  };
}
*/

export class GenericDataLoader {
  private static loaders;

  private static subject;

  constructor() {
    logger.log('init ...');
    if (!GenericDataLoader.subject) {
      GenericDataLoader.subject = (event: IAsunaEvent) => {
        // logger.log(`subscribe ${JSON.stringify(value)}`);
      };
      Hermes.subscribe(GenericDataLoader.name, 'fanout', GenericDataLoader.subject);
    }
  }

  initLoaders(loaders: { [key: string]: DataLoaderFunction<any> }) {
    GenericDataLoader.loaders = loaders;
  }

  createLoaders() {
    return _.memoize(() => GenericDataLoader.loaders)();
  }
}

export function cachedDataLoader(segment, fn) {
  return new DataLoader(
    ids => {
      // logger.log(`load ${segment}: ${ids}`);
      return fn(ids);
    },
    {
      // cacheKeyFn: (id: number) => {
      //   logger.log(`cast (${segment}:${id})`);
      //   return `${id}`;
      // },
      cacheMap: {
        get: (id: string) => {
          // const cachedObject = await client.get({ segment, id });
          // logger.log(`get (${segment}:${id}) ${util.inspect(cachedObject)}`);
          // return cachedObject;
          const now = Date.now();
          // console.log({ size: cacheMap.size });
          const key = `${segment}-${id}`;
          // console.log('cacheMap load', key);
          const { value, expires } = cacheMap.get(key) || ({} as any);
          // console.log('cacheMap load', { key, value });
          if (!value) {
            return null;
          }
          // FIXME 采用 EntitySubscriber 的 afterUpdate 来激活清理函数，暂时关闭函数过期
          const isExpired = expires < now && false;
          // logger.log(
          //   `get (${segment}:${id}) ${r(
          //     {
          //       exists: !!value,
          //       expires: new Date(expires),
          //       now: new Date(now),
          //       left: expires - now,
          //       isExpired,
          //     },
          //   )}`,
          // );
          if (isExpired) {
            cacheMap.delete(key);
            return null;
          }
          return value;
        },
        set: (id: string, value) => {
          const key = `${segment}-${id}`;
          // console.log('cacheMap set', key);
          const now = Date.now();
          // logger.log(`has (${segment}:${id})[${cacheMap.size}]${cacheMap.has(key)}`);
          // if (!cacheMap.has(key)) {
          //   cacheMap.set(key, { value, expires: now + 1 * 60 * 1000 });
          //   // console.log({ size: cacheMap.size });
          // }
          cacheMap.set(key, { value, expires: now + 5 * 60 * 1000 });
        },
        delete: (id: string) => {
          // logger.log(`delete (${segment}:${id})`);
          const key = `${segment}-${id}`;
          cacheMap.delete(key);
          // return client.drop({ segment, id });
        },
        clear: () => {
          // logger.log(`clear (${segment})`);
          cacheMap.clear();
          // return logger.warn('clear is not implemented.');
        },
      },
    },
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
  if (!info || !path) return true;

  try {
    const locations = path.split('.');
    const fieldNode = info.fieldNodes.find(node => node.name.value === locations[0]);
    if (fieldNode == null) {
      return true;
    }

    let selectionNode;
    _.times(locations.length - 1).forEach(index => {
      selectionNode = (selectionNode || fieldNode).selectionSet.selections.find(
        node => (node as any).name.value === locations[index + 1],
      );
    });
    const relations = (selectionNode || fieldNode).selectionSet.selections
      .filter(node => node.selectionSet)
      .map(node => node.name.value);
    return { relations };
  } catch (error) {
    logger.warn(`resolveRelationsFromInfo ${r(error)}`);
    return true;
  }
}
