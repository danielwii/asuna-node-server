import { Logger } from '@nestjs/common';

import { RedisLockProvider } from '@danielwii/asuna-helper/dist/providers/redis/lock.provider';
import { r } from '@danielwii/asuna-helper/dist/serializer';

import { CronJob, CronJobParameters } from 'cron';
import cronParser from 'cron-parser';
import dayjs from 'dayjs';
import calendar from 'dayjs/plugin/calendar';
import relativeTime from 'dayjs/plugin/relativeTime';
import _ from 'lodash';

import { FeaturesConfigure } from '../config/features.config';
import { StatsHelper } from '../stats/stats.helper';

import type { StatsResult } from '../stats/stats.interface';

dayjs.extend(calendar);
dayjs.extend(relativeTime);

/**
 * @deprecated {@see CronService}
 */
export class CronHelper {
  public static crons = {};

  public static nextTime(cronTime: string): { next: Date; calendar: string; fromNow: string } {
    const next = cronParser.parseExpression(cronTime).next().toDate();
    return { next, fromNow: dayjs(next).fromNow(), calendar: dayjs(next).calendar() };
  }

  public static reg<Value>(
    operation: string,
    cronTime: string,
    handler: () => Promise<StatsResult<Value> | any>,
    opts: Omit<CronJobParameters, 'cronTime' | 'onTick'> & {
      // ttl in seconds
      ttl?: number;
    } = {},
  ): CronJob {
    CronHelper.crons[operation] = { cronTime, nextTime: CronHelper.nextTime(cronTime) };

    if (!new FeaturesConfigure().load().cronEnable) {
      Logger.warn(`skip ${operation} because cron was not enabled.`);
      return undefined;
    }

    const ttl = opts.ttl ?? 10;
    const enabledRedis = RedisLockProvider.instance.isEnabled();
    Logger.debug(
      `init cron ${r({ operation, cronTime, ...CronHelper.nextTime(cronTime), opts, enabled: enabledRedis })}`,
    );
    const callPromise = () =>
      enabledRedis
        ? RedisLockProvider.instance
            .lockProcess(operation, handler, { ttl: ttl * 1000 })
            .catch((reason) => Logger.error(reason))
        : handler().catch((reason) => Logger.error(reason));

    return new CronJob({
      cronTime,
      onTick: () =>
        callPromise()
          .then((result) => {
            if (result) {
              const event = {
                cronTime,
                next: CronHelper.nextTime(cronTime),
                ...(_.isObject(result) ? result : { value: result }),
              };
              Logger.debug(`cron ${operation} success, next in ${r(event.next.fromNow)}.`);
              StatsHelper.addCronSuccessEvent(operation, event).catch((reason) =>
                Logger.error(`cron ${operation} error: ${r(reason)}`),
              );
            }
            return result;
          })
          .catch((reason) => {
            Logger.error(`${operation} error found: ${r(reason)}`);
            StatsHelper.addCronFailureEvent(operation, {
              cronTime,
              next: CronHelper.nextTime(cronTime),
              reason,
            }).catch((err) => Logger.error(`addCronFailureEvent error: ${r(err)}`));
          })
          .finally(() => {
            const next = CronHelper.nextTime(cronTime);
            if (dayjs(next.next).diff(new Date(), 'minute') > 1)
              Logger.debug(`${operation} done. ${r({ cronTime, ...next })}`);
          }),
      /*
      onComplete: () => {
        Logger.debug(`${operation} completed.`);
        if (_.isFunction(opts.onComplete)) opts.onComplete();
      }, */
      runOnInit: false,
      start: true,
      ..._.omit(opts, 'ttl'),
    });
  }
}
