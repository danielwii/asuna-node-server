import * as DataLoader from 'dataloader';
import { GraphQLResolveInfo } from 'graphql';
import * as _ from 'lodash';
import * as fp from 'lodash/fp';
import { BaseEntity } from 'typeorm';
import { r } from '../common/helpers';
import { LoggerFactory } from '../common/logger';

const logger = LoggerFactory.getLogger('DataLoaderCache');

const cacheMap = new Map();

export type PrimaryKeyType = string | number;

export interface DataLoaderFunction<Entity extends BaseEntity> {
  load(id: PrimaryKeyType): Promise<Entity>;
  load(ids: PrimaryKeyType[]): Promise<Entity[]>;
}

function resolve(ids: PrimaryKeyType[]) {
  return entities => ids.map(id => entities.find(entity => (entity ? entity.id === id : false)));
}

function build<Entity extends BaseEntity>(
  dataloader: DataLoader<PrimaryKeyType, Entity>,
): DataLoaderFunction<Entity> {
  return {
    load(ids: PrimaryKeyType | PrimaryKeyType[]) {
      if (_.isArray(ids)) {
        return !_.isEmpty(ids)
          ? (dataloader.loadMany(ids as PrimaryKeyType[]).then(fp.compact) as any)
          : null;
      }
      return ids ? dataloader.load(ids as PrimaryKeyType) : null;
    },
  };
}

export function loader<Entity extends BaseEntity>(
  entity: typeof BaseEntity,
  opts: { isPublished?: boolean; loadRelationIds?: boolean } = {},
): DataLoaderFunction<Entity> {
  return build<Entity>(
    cachedDataLoader(entity.name, ids =>
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
      /*
      Hermes.subscribe(GenericDataLoader.name, 'fanout', (event: IAsunaEvent) => {
        logger.log(`subscribe ${event.name} ${r(event)}`);
      });
*/
    }
  }

  // eslint-disable-next-line class-methods-use-this
  initLoaders(loaders: { [key: string]: DataLoaderFunction<any> }): void {
    GenericDataLoader.loaders = loaders;
  }

  // eslint-disable-next-line class-methods-use-this
  createLoaders(): { [key: string]: DataLoaderFunction<any> } {
    return _.memoize(() => GenericDataLoader.loaders)();
  }
}

export function cachedDataLoader(segment, fn): DataLoader<PrimaryKeyType, any> {
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
          logger.log(`dataloader set ${r({ key })}`);
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
  if (!info || !path) return false;

  try {
    const locations = path.split('.');
    const fieldNode = info.fieldNodes.find(node => node.name.value === locations[0]);
    if (fieldNode == null) {
      return false;
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
    logger.verbose(`resolved relations is ${r(relations)}`);
    return { relations };
  } catch (error) {
    logger.warn(`resolveRelationsFromInfo ${r(error)}`);
    return false;
  }
}
