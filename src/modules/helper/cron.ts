import { CronJob, CronJobParameters } from 'cron';
import * as cronParser from 'cron-parser';
import * as dayjs from 'dayjs';
import * as calendar from 'dayjs/plugin/calendar';
import * as relativeTime from 'dayjs/plugin/relativeTime';
import * as _ from 'lodash';
import { r } from '../common/helpers';
import { LoggerFactory } from '../common/logger';
import { configLoader } from '../config';
import { RedisLockProvider } from '../providers';

dayjs.extend(calendar);
dayjs.extend(relativeTime);

const logger = LoggerFactory.getLogger('CronHelper');

export class CronHelper {
  private static readonly redis = RedisLockProvider.instance;

  static nextTime(cronTime: string) {
    const next = cronParser
      .parseExpression(cronTime)
      .next()
      .toDate();
    return { next, fromNow: dayjs(next).fromNow(), calendar: dayjs(next).calendar() };
  }

  static reg(
    operation: string,
    cronTime: string,
    handler: () => Promise<any>,
    opts: Omit<CronJobParameters, 'cronTime' | 'onTick'> & {
      // ttl in seconds
      ttl?: number;
    } = {},
  ): void {
    if (!configLoader.loadBoolConfig('CRON_ENABLE', true)) {
      return logger.warn(`skip ${operation} cron not enabled.`);
    }

    const ttl = opts.ttl ?? 10;
    logger.verbose(`init cron ${r({ operation, cronTime, ...this.nextTime(cronTime), opts })}`);
    const promise = this.redis.isEnabled ? this.redis.lockProcess(operation, handler, { ttl: ttl * 1000 }) : handler();
    new CronJob({
      cronTime,
      onTick: () =>
        promise.finally(() =>
          logger.verbose(`${operation} done. next: ${r({ cronTime, ...this.nextTime(cronTime) })}`),
        ),
      onComplete: () => {
        logger.verbose(`${operation} completed.`);
        if (_.isFunction(opts.onComplete)) opts.onComplete();
      },
      runOnInit: false,
      ..._.omit(opts, 'ttl'),
    });
  }
}
