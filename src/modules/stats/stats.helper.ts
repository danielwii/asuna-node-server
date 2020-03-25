import { InMemoryDB } from '../cache/db';
import { r } from '../common/helpers/utils';
import { LoggerFactory } from '../common/logger';
import { CronStatsInterface } from './stats.interface';

type CronStat = Omit<CronStatsInterface, 'events'>;

const logger = LoggerFactory.getLogger('StatsHelper');

export class StatsHelper {
  static prefix = 'stats';

  static async addErrorInfo(type: string, info): Promise<void> {
    const key = `error-${type}`;
    logger.log(`add error info ${r({ key, info })}`);
    const errors = await InMemoryDB.list({ prefix: this.prefix, key });
    logger.log(`current errors length is ${errors?.length}`);
    await InMemoryDB.insert({ prefix: this.prefix, key }, () => Promise.resolve({ info, createdAt: new Date() }));
  }

  static async addCronSuccessEvent(key: string, event): Promise<void> {
    logger.log(`add cron success event ${r({ key, event })}`);
    const cronStat = (await InMemoryDB.get({ prefix: this.prefix, key })) as CronStat;
    if (cronStat) {
      logger.log(`current stat is ${r(cronStat)}`);
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

  static async addCronFailureEvent(key: string, event): Promise<void> {
    logger.log(`add cron failure event ${r({ key, event })}`);
    const cronStat = (await InMemoryDB.get({ prefix: this.prefix, key })) as CronStat;
    if (cronStat) {
      logger.log(`current stat is ${r(cronStat)}`);
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
