import { CronJob, CronJobParameters } from 'cron';
import * as cronParser from 'cron-parser';
import dayjs from 'dayjs';
import calendar from 'dayjs/plugin/calendar';
import relativeTime from 'dayjs/plugin/relativeTime';
import * as _ from 'lodash';

import { r } from '../common/helpers';
import { LoggerFactory } from '../common/logger';
import { RedisLockProvider } from '../providers/redis-lock.provider';
import { StatsHelper } from '../stats/stats.helper';
import { StatsResult } from '../stats/stats.interface';
import { FeaturesConfigObject } from '../config/features.config';

dayjs.extend(calendar);
dayjs.extend(relativeTime);

const logger = LoggerFactory.getLogger('CronHelper');

export class CronHelper {
  public static crons = {};

  public static nextTime(cronTime: string): { next: Date; calendar: string; fromNow: string } {
    const next = cronParser.parseExpression(cronTime).next().toDate();
    return { next, fromNow: dayjs(next).fromNow(), calendar: dayjs(next).calendar() };
  }

  public static reg<Value extends any>(
    operation: string,
    cronTime: string,
    handler: () => Promise<StatsResult<Value> | any>,
    opts: Omit<CronJobParameters, 'cronTime' | 'onTick'> & {
      // ttl in seconds
      ttl?: number;
    } = {},
  ): CronJob {
    this.crons[operation] = { cronTime, nextTime: this.nextTime(cronTime) };

    if (!FeaturesConfigObject.load().cronEnable) {
      logger.warn(`skip ${operation} because cron was not enabled.`);
      return undefined;
    }

    const ttl = opts.ttl ?? 10;
    const enabled = RedisLockProvider.instance.isEnabled();
    logger.debug(`init cron ${r({ operation, cronTime, ...this.nextTime(cronTime), opts, enabled })}`);
    const callPromise = () =>
      enabled
        ? RedisLockProvider.instance
            .lockProcess(operation, handler, { ttl: ttl * 1000 })
            .catch((reason) => logger.error(reason))
        : handler().catch((reason) => logger.error(reason));

    return new CronJob({
      cronTime,
      onTick: () =>
        callPromise()
          .then((result) => {
            if (result) {
              const event = {
                cronTime,
                next: this.nextTime(cronTime),
                ...(_.isObject(result) ? result : { value: result }),
              };
              // logger.debug(`addCronSuccessEvent to ${r({ operation, event })}`);
              StatsHelper.addCronSuccessEvent(operation, event).catch((reason) =>
                logger.error(`addCronSuccessEvent error: ${r(reason)}`),
              );
            }
            return result;
          })
          .catch((reason) => {
            logger.error(`${operation} error found: ${r(reason)}`);
            StatsHelper.addCronFailureEvent(operation, {
              cronTime,
              next: this.nextTime(cronTime),
              reason,
            }).catch((err) => logger.error(`addCronFailureEvent error: ${r(err)}`));
          })
          .finally(() => {
            const next = this.nextTime(cronTime);
            if (dayjs(next.next).diff(new Date(), 'minute') > 1)
              logger.debug(`${operation} done. next: ${r({ cronTime, ...next })}`);
          }),
      /*
      onComplete: () => {
        logger.debug(`${operation} completed.`);
        if (_.isFunction(opts.onComplete)) opts.onComplete();
      }, */
      runOnInit: false,
      start: true,
      ..._.omit(opts, 'ttl'),
    });
  }
}
