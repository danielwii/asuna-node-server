import { InMemoryDB } from '../cache/db';
import { r } from '../common/helpers/utils';
import { LoggerFactory } from '../common/logger';
import { CronStatsInterface, EventStatsInterface } from './stats.interface';

type CronStat = Omit<CronStatsInterface, 'events'>;

const logger = LoggerFactory.getLogger('StatsHelper');

export class StatsHelper {
  static prefix = 'stats';

  static async addCronSuccessEvent(key: string, event) {
    logger.log(`add cron event ${r({ key, event })}`);
    const cronStat = (await InMemoryDB.get({ prefix: this.prefix, key })) as CronStat;
    if (cronStat) {
      logger.log(`current stat is ${r(cronStat)}`);
    }
  }

  static async addCronFailureEvent(key: string, event) {
    logger.log(`add cron event ${r({ key, event })}`);
    const cronStat = (await InMemoryDB.get({ prefix: this.prefix, key })) as CronStat;
    if (cronStat) {
      logger.log(`current stat is ${r(cronStat)}`);
    }
  }
}
