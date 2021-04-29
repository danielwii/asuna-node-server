import { LoggerFactory } from '@danielwii/asuna-helper/dist/logger';
import { RedisLockProvider } from '@danielwii/asuna-helper/dist/providers/redis/lock.provider';
import { r } from '@danielwii/asuna-helper/dist/serializer';

import { Promise } from 'bluebird';
import { glob } from 'glob';
import _ from 'lodash';
import { dirname, extname, resolve } from 'path';
import { Connection } from 'typeorm';

import { renameTables, runCustomMigrations } from './migrations';
import { TimeUnit } from './modules/common/helpers/utils';
import { configLoader } from './modules/config/loader';
import { Global } from './modules/core/global';

import type { NestExpressApplication } from '@nestjs/platform-express';
import type { BootstrapOptions } from './interface';

export function validateOptions(options: BootstrapOptions): void {
  // const config = configLoader.loadConfigs();
  const redisEnabled = configLoader.loadConfig2('redis', 'enable');

  if (options.redisMode === 'redis' && !redisEnabled) {
    throw new Error('RedisMode need redis enabled!');
  }

  // if (redisEnabled) {
  //   const instance = RedisLockProvider.instance;
  //   console.log('get redis lock instance ->', instance);
  // }
  // process.exit(0);
}

export async function syncDbWithLockIfPossible(app: NestExpressApplication, options: BootstrapOptions) {
  const logger = LoggerFactory.getLogger('sync');
  const syncEnabled = configLoader.loadBoolConfig('DB_SYNCHRONIZE');
  if (!syncEnabled) {
    return logger.log(`DB_SYNCHRONIZE disabled.`);
  }

  logger.log(`DB_SYNCHRONIZE: ${syncEnabled}`);
  const redisEnabled = configLoader.loadConfig2('redis', 'enable');
  if (redisEnabled) {
    logger.log('try sync db with redis redlock...');
    const { exists, results } = await RedisLockProvider.instance.lockProcess(
      'sync-db',
      async () => syncDb(app, options),
      { ttl: TimeUnit.MINUTES.toMillis(3), waiting: true },
    );
    logger.log(`sync results is ${r({ exists, results })}`);
    if (exists) {
      logger.log('another runner is syncing db now, skip.');
    }
    return results;
  } else {
    return syncDb(app, options);
  }
}

async function syncDb(app: NestExpressApplication, options: BootstrapOptions): Promise<void> {
  const logger = LoggerFactory.getLogger('sync');

  // --------------------------------------------------------------
  // rename old tables to newer
  // --------------------------------------------------------------

  const beforeSyncDB = Date.now();
  const connection = app.get<Connection>(Connection);
  logger.log(`db connected: ${r({ isConnected: connection.isConnected, name: connection.name })}`);

  logger.log('sync db ...');
  const queryRunner = connection.createQueryRunner();
  await Promise.all(
    _.map(_.compact(renameTables.concat(options.renamer)), async ({ from, to }) => {
      logger.log(`rename table ${r({ from, to })}`);
      const fromTable = await queryRunner.getTable(from);
      const toTable = await queryRunner.getTable(to);
      if (toTable) {
        logger.warn(`Table ${to} already exists.`);
      } else if (fromTable) {
        logger.log(`rename ${from} -> ${to}`);
        await queryRunner.renameTable(fromTable, to);
      }
    }),
  );

  if (['mariadb', 'mysql56', 'mysql57', 'mysql8'].includes(Global.dbType)) {
    await connection.query('SET FOREIGN_KEY_CHECKS=0');
  }

  logger.log(`synchronize ...`);
  await connection.synchronize();
  logger.log(`synchronize ... done`);

  logger.log(`run custom migrations ...`);
  await runCustomMigrations(options.migrations);
  logger.log(`run custom migrations ... done`);

  if (['mariadb', 'mysql56', 'mysql57', 'mysql8'].includes(Global.dbType)) {
    await connection.query('SET FOREIGN_KEY_CHECKS=1');
  }
  logger.log(`sync db done. ${Date.now() - beforeSyncDB}ms`);

  logger.log(`pending migrations: ${await connection.showMigrations()}`);
}

/**
 * 根据环境变量调整要拉取的实体
 * @param options
 */
export async function resolveTypeormPaths(options?: BootstrapOptions): Promise<void> {
  const logger = LoggerFactory.getLogger('resolveTypeormPaths');
  // const wasBuilt = __filename.endsWith('js');
  const rootDir = dirname(require.main.filename);
  logger.log(`main entrance is ${r(require.main.filename)}`);
  const { packageDir } = global;
  const suffix = extname(__filename).slice(1);
  const currentSuffix = extname(require.main.filename).slice(1);
  // const convertPackage = suffix === 'js' ? _.replace(/dist/, 'src') : _.replace(/src/, 'dist');
  const pathResolver = (mode: 'entities' | 'subscriber') => [
    // `${resolve(rootDir, '../..')}/packages/*/${suffix === 'js' ? 'dist' : 'src'}/**/*${mode}.${suffix}`,
    // 地址不同时这里认为是用特定的环境配置来拉取 packages 下的相关实体，即 monorepo 模式
    rootDir !== packageDir
      ? `${resolve(packageDir, '../..')}/*/${suffix === 'js' ? 'dist' : 'src'}/**/*${mode}.${suffix}`
      : `${resolve(packageDir)}/**/*${mode}.${suffix}`,
    `${resolve(rootDir)}/**/*${mode}.${currentSuffix}`,
  ];
  const entities = _.uniq(_.compact([...pathResolver('entities'), ...(options?.typeormEntities || [])]));
  const subscribers = _.uniq(_.compact([...pathResolver('subscriber'), ...(options?.typeormSubscriber || [])]));
  logger.log(`options is ${r({ options, packageDir, rootDir, suffix, entities, subscribers, __filename })}`);

  logger.log(`resolve typeorm entities: ${r(entities)}`);
  logger.log(`resolve typeorm subscribers: ${r(subscribers)}`);

  await Promise.map(entities, promisifyGlob).then((resolved) => logger.debug(`resolved entities ${r(resolved)}`));
  await Promise.map(subscribers, promisifyGlob).then((resolved) => logger.debug(`resolved subscribers ${r(resolved)}`));

  process.env.TYPEORM_ENTITIES = entities.join();
  process.env.TYPEORM_SUBSCRIBERS = subscribers.join();
}

function promisifyGlob(pattern: string): Promise<string[]> {
  return new Promise((resolve, reject) => glob(pattern, {}, (err, matches) => (err ? reject(err) : resolve(matches))));
}
