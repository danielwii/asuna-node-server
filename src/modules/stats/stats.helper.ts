import { Logger } from '@nestjs/common';

import { r } from '@danielwii/asuna-helper/dist/serializer';

import _ from 'lodash';

import { CacheTTL } from '../cache/constants';
import { InMemoryDB } from '../cache/db';
import { FeaturesConfigObject } from '../config/features.config';

import type { CronStatsInterface } from './stats.interface';

type CronStat = Omit<CronStatsInterface, 'events'>;

export class StatsHelper {
  private static enable = FeaturesConfigObject.instance.errorStats;

  public static prefix = 'stats';
  public static keys = new Set<string>();

  public static async addErrorInfo(type: string, info): Promise<void> {
    if (!this.enable) return;

    const key = `error-${type}`;
    this.keys.add(key);
    // logger.debug(`add error info ${r({ key, info })}`);
    const opts = { prefix: this.prefix, key };
    const errors = await InMemoryDB.list(opts);
    Logger.debug(`current errors length is ${errors?.length}`);
    if (errors?.length > 1000) {
      // todo remove more
      await InMemoryDB.clear(opts);
    }

    await InMemoryDB.insert({ prefix: this.prefix, key }, () => Promise.resolve({ info, createdAt: new Date() }));
    const statsKey = `error-stats`;
    // logger.log(`try save stats ${statsKey}`);
    await InMemoryDB.save(
      statsKey,
      async (saved) => {
        const stats = saved ?? {};
        const newValue = _.isNumber(stats[key]) ? stats[key] + 1 : 0;
        const newStats = { ...stats, [key]: newValue };
        Logger.debug(`update stats ${r({ stats, newStats, key, value: stats[key], newValue })}`);
        return newStats;
      },
      { expiresInSeconds: CacheTTL.WEEK },
    );
  }

  public static async addCronSuccessEvent(key: string, event): Promise<void> {
    // logger.verbose(`add cron success event ${r({ key, event })}`);
    const cronStat = (await InMemoryDB.get({ prefix: this.prefix, key })) as CronStat;
    if (cronStat) {
      // logger.log(`current stat is ${r(cronStat)}`);
      await InMemoryDB.save({ prefix: this.prefix, key }, () =>
        Promise.resolve({
          ...cronStat,
          success: cronStat.success + 1,
          latestAt: new Date(),
          nextAt: event.next,
          verbose: { stats: event.stats, value: event.value },
        }),
      );
    } else {
      const stat: CronStat = {
        success: 1,
        failure: 0,
        latestAt: new Date(),
        nextAt: event.next,
        verbose: { stats: event.stats, value: event.value },
      };
      await InMemoryDB.save({ prefix: this.prefix, key }, () => Promise.resolve(stat));
    }
  }

  public static async addCronFailureEvent(key: string, event): Promise<void> {
    Logger.log(`add cron failure event ${r({ key, event })}`);
    const cronStat = (await InMemoryDB.get({ prefix: this.prefix, key })) as CronStat;
    if (cronStat) {
      Logger.log(`current stat is ${r(cronStat)}`);
      await InMemoryDB.save({ prefix: this.prefix, key }, () =>
        Promise.resolve({
          ...cronStat,
          failure: cronStat.failure + 1,
          latestAt: new Date(),
          nextAt: event.next,
          verbose: { stats: event.stats, value: event.value },
        }),
      );
    } else {
      const stat: CronStat = {
        success: 0,
        failure: 1,
        latestAt: new Date(),
        nextAt: event.next,
        verbose: { stats: event.stats, value: event.value },
      };
      await InMemoryDB.save({ prefix: this.prefix, key }, () => Promise.resolve(stat));
    }
  }
}
