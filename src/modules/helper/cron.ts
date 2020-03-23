import { CronJob, CronJobParameters } from 'cron';
import * as cronParser from 'cron-parser';
import * as dayjs from 'dayjs';
import * as calendar from 'dayjs/plugin/calendar';
import * as relativeTime from 'dayjs/plugin/relativeTime';
import * as _ from 'lodash';
import { r } from '../common/helpers';
import { LoggerFactory } from '../common/logger';
import { ConfigKeys, configLoader } from '../config';
import { RedisLockProvider } from '../providers';
import { StatsResult } from '../stats/stats.interface';
import { StatsHelper } from '../stats/stats.helper';

dayjs.extend(calendar);
dayjs.extend(relativeTime);

const logger = LoggerFactory.getLogger('CronHelper');

export class CronHelper {
  private static readonly redis = RedisLockProvider.instance;

  static nextTime(cronTime: string): { next: Date; calendar: string; fromNow: string } {
    const next = cronParser
      .parseExpression(cronTime)
      .next()
      .toDate();
    return { next, fromNow: dayjs(next).fromNow(), calendar: dayjs(next).calendar() };
  }

  static reg<Value extends any>(
    operation: string,
    cronTime: string,
    handler: () => Promise<StatsResult<Value>>,
    opts: Omit<CronJobParameters, 'cronTime' | 'onTick'> & {
      // ttl in seconds
      ttl?: number;
    } = {},
  ): CronJob {
    if (!configLoader.loadBoolConfig(ConfigKeys.CRON_ENABLE, true)) {
      logger.warn(`skip ${operation} cron not enabled.`);
      return null;
    }

    const ttl = opts.ttl ?? 10;
    const enabled = this.redis.isEnabled();
    logger.verbose(`init cron ${r({ operation, cronTime, ...this.nextTime(cronTime), opts, enabled })}`);
    const callPromise = () =>
      enabled
        ? this.redis.lockProcess(operation, handler, { ttl: ttl * 1000 }).catch(reason => logger.error(reason))
        : handler().catch(reason => logger.error(reason));

    return new CronJob({
      cronTime,
      onTick: () =>
        callPromise()
          .then(result => {
            StatsHelper.addCronSuccessEvent(operation, {
              cronTime,
              next: this.nextTime(cronTime),
              ...(_.isObject(result) ? result : { value: result }),
            }).catch(reason => logger.error(`addCronSuccessEvent error: ${r(reason)}`));
            return result;
          })
          .catch(reason => {
            logger.error(`${operation} error found: ${r(reason)}`);
            StatsHelper.addCronFailureEvent(operation, { cronTime, next: this.nextTime(cronTime), reason }).catch(err =>
              logger.error(`addCronFailureEvent error: ${r(err)}`),
            );
          })
          .finally(() => logger.verbose(`${operation} done. next: ${r({ cronTime, ...this.nextTime(cronTime) })}`)),
      /*
      onComplete: () => {
        logger.verbose(`${operation} completed.`);
        if (_.isFunction(opts.onComplete)) opts.onComplete();
      }, */
      runOnInit: false,
      ..._.omit(opts, 'ttl'),
    });
  }
}
