import { Logger } from '@nestjs/common';

import { RedisLockProvider } from '@danielwii/asuna-helper/dist/providers/redis/lock.provider';
import { r } from '@danielwii/asuna-helper/dist/serializer';
import { isProductionEnv } from '@danielwii/asuna-helper/dist/utils';

import bluebird from 'bluebird';
import glob from 'glob';
import _ from 'lodash';
import { dirname, extname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { DataSource } from 'typeorm';

import { renameTables, runCustomMigrations } from './migrations';
import { TimeUnit } from './modules/common/helpers/utils';
import { configLoader } from './modules/config/loader';
import { Global } from './modules/core/global';

import type { NestExpressApplication } from '@nestjs/platform-express';
import type { BootstrapOptions } from './interface';

const { Promise } = bluebird;

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
  const syncEnabled = configLoader.loadBoolConfig('DB_SYNCHRONIZE');
  if (!syncEnabled) {
    return Logger.log(`DB_SYNCHRONIZE disabled.`);
  }

  Logger.log(`DB_SYNCHRONIZE: ${syncEnabled}`);
  const redisEnabled = configLoader.loadConfig2('redis', 'enable');
  if (redisEnabled) {
    Logger.log('try sync db with redis redlock...');
    const { exists, results } = await RedisLockProvider.instance.lockProcess(
      'sync-db',
      async () => syncDb(app, options),
      { ttl: TimeUnit.MINUTES.toMillis(3), waiting: true },
    );
    Logger.log(`sync results is ${r({ exists, results })}`);
    if (exists) {
      Logger.log('another runner is syncing db now, skip.');
    }
    return results;
  } else {
    return syncDb(app, options);
  }
}

async function syncDb(app: NestExpressApplication, options: BootstrapOptions): Promise<void> {
  // --------------------------------------------------------------
  // rename old tables to newer
  // --------------------------------------------------------------

  const beforeSyncDB = Date.now();
  const connection = app.get<DataSource>(DataSource);
  Logger.log(`db connected: ${r({ isConnected: connection.isConnected, name: connection.name })}`);

  Logger.log('sync db ...');
  const queryRunner = connection.createQueryRunner();
  await Promise.all(
    _.map(_.compact(renameTables.concat(options.renamer)), async ({ from, to }) => {
      Logger.log(`rename table ${r({ from, to })}`);
      const fromTable = await queryRunner.getTable(from);
      const toTable = await queryRunner.getTable(to);
      if (toTable) {
        Logger.warn(`Table ${to} already exists.`);
      } else if (fromTable) {
        Logger.log(`rename ${from} -> ${to}`);
        await queryRunner.renameTable(fromTable, to);
      }
    }),
  );

  if (['mariadb', 'mysql56', 'mysql57', 'mysql8'].includes(Global.dbType)) {
    await connection.query('SET FOREIGN_KEY_CHECKS=0');
  }

  Logger.log(`synchronize ...`);
  await connection.synchronize();
  Logger.log(`synchronize ... done`);

  Logger.log(`run custom migrations ...`);
  await runCustomMigrations(options.migrations);
  Logger.log(`run custom migrations ... done`);

  if (['mariadb', 'mysql56', 'mysql57', 'mysql8'].includes(Global.dbType)) {
    await connection.query('SET FOREIGN_KEY_CHECKS=1');
  }
  Logger.log(`sync db done. ${Date.now() - beforeSyncDB}ms`);

  Logger.log(`pending migrations: ${await connection.showMigrations()}`);
}

/**
 * 根据环境变量调整要拉取的实体
 * @param options
 */
export async function resolveTypeormPaths(options?: BootstrapOptions): Promise<void> {
  // const wasBuilt = __filename.endsWith('js');
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  const __entrance = pathToFileURL(process.argv[1]).href;
  const __rootPath = dirname(dirname(fileURLToPath(__entrance)));
  Logger.log(`main entrance is ${r(__dirname)}`);
  const suffix = extname(__filename).slice(1);
  const currentSuffix = isProductionEnv ? 'js' : 'ts'; // extname(import.meta.url).slice(1);
  // const convertPackage = suffix === 'js' ? _.replace(/dist/, 'src') : _.replace(/src/, 'dist');
  const pathResolver = (type: 'entities' | 'subscriber') => [
    // `${resolve(rootDir, '../..')}/packages/*/${suffix === 'js' ? 'dist' : 'src'}/**/*${type}.${suffix}`,
    // 地址不同时这里认为是用特定的环境配置来拉取 packages 下的相关实体，即 monorepo 模式
    __rootPath !== __dirname
      ? `${resolve(__dirname, '../..')}/*/${suffix === 'js' ? 'dist' : 'src'}/**/*${type}.${suffix}`
      : `${resolve(__dirname)}/**/*${type}.${suffix}`,
    `${resolve(__rootPath)}/**/*${type}.${currentSuffix}`,
  ];
  const entities = _.uniq(_.compact([...pathResolver('entities'), ...(options?.typeormEntities || [])]));
  const subscribers = _.uniq(_.compact([...pathResolver('subscriber'), ...(options?.typeormSubscriber || [])]));
  Logger.log(`options is ${r({ options, __dirname, __rootPath, suffix, entities, subscribers, __filename })}`);

  Logger.log(`resolve typeorm entities: ${r(entities)}`);
  Logger.log(`resolve typeorm subscribers: ${r(subscribers)}`);

  await Promise.map(entities, promisifyGlob).then((resolved) => Logger.debug(`resolved entities ${r(resolved)}`));
  await Promise.map(subscribers, promisifyGlob).then((resolved) => Logger.debug(`resolved subscribers ${r(resolved)}`));

  process.env.TYPEORM_ENTITIES = entities.join();
  process.env.TYPEORM_SUBSCRIBERS = subscribers.join();
}

function promisifyGlob(pattern: string): Promise<string[]> {
  return new Promise((resolve, reject) => glob(pattern, {}, (err, matches) => (err ? reject(err) : resolve(matches))));
}
