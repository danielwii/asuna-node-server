import _ from 'lodash';
import { dirname, extname, resolve } from 'path';
import { Connection } from 'typeorm';

import { renameTables, runCustomMigrations } from './migrations';
import { r } from './modules/common/helpers/utils';
import { LoggerFactory } from './modules/common/logger/factory';
import { configLoader } from './modules/config/loader';
import { Global } from './modules/core/global';
import { RedisLockProvider } from './modules/providers/redis-lock.provider';

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
      { ttl: 3 * 60 * 1000, waiting: true },
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
export function resolveTypeormPaths(options?: BootstrapOptions): void {
  const logger = LoggerFactory.getLogger('resolveTypeormPaths');
  // const wasBuilt = __filename.endsWith('js');
  const rootDir = dirname(require.main.filename);
  logger.log(`main entrance is ${r(require.main.filename)}`);
  const { packageDir } = global;
  const suffix = extname(__filename).slice(1);
  const currentSuffix = extname(require.main.filename).slice(1);
  // const convertPackage = suffix === 'js' ? _.replace(/dist/, 'src') : _.replace(/src/, 'dist');
  const entities = _.uniq([
    // fixme remove first later
    `${resolve(rootDir, '../..')}/packages/*/${suffix === 'js' ? 'dist' : 'src'}/**/*entities.${suffix}`,
    // `${resolve(packageDir, '../..')}/**/*entities.${suffix}`,
    `${resolve(packageDir)}/**/*entities.${suffix}`,
    `${resolve(rootDir)}/**/*entities.${currentSuffix}`,
    ...(options?.typeormEntities || []),
  ]);
  const subscribers = _.uniq([
    `${resolve(rootDir, '../..')}/packages/*/${suffix === 'js' ? 'dist' : 'src'}/**/*subscriber.${suffix}`,
    `${resolve(packageDir)}/**/*subscriber.${suffix}`,
    `${resolve(rootDir)}/**/*subscriber.${currentSuffix}`,
  ]);
  logger.log(`options is ${r({ options, packageDir, rootDir, suffix, entities, subscribers, __filename })}`);

  logger.log(`resolve typeorm entities: ${r(entities)}`);
  logger.log(`resolve typeorm subscribers: ${r(subscribers)}`);

  process.env.TYPEORM_ENTITIES = entities.join();
  process.env.TYPEORM_SUBSCRIBERS = subscribers.join();
}
