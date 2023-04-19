import { Injectable, Logger } from '@nestjs/common';

import { resolveModule } from '@danielwii/asuna-helper/dist/logger/factory';
import { RedisLockProvider } from '@danielwii/asuna-helper/dist/providers/redis/lock.provider';
import { r } from '@danielwii/asuna-helper/dist/serializer';

import { fileURLToPath } from 'node:url';

import { CronJob, CronJobParameters } from 'cron';
import cronParser from 'cron-parser';
import dayjs from 'dayjs';
import calendar from 'dayjs/plugin/calendar';
import relativeTime from 'dayjs/plugin/relativeTime';
import _ from 'lodash';

import { FeaturesConfigure } from '../config';
import { StatsHelper, StatsResult } from '../stats';

@Injectable()
export class CronService {
  private readonly logger = new Logger(resolveModule(fileURLToPath(import.meta.url), this.constructor.name));
  private static crons = {};
  public constructor() {
    dayjs.extend(calendar);
    dayjs.extend(relativeTime);
  }

  public nextTime(cronTime: string): { next: Date; calendar: string; fromNow: string } {
    const next = cronParser.parseExpression(cronTime).next().toDate();
    return { next, fromNow: dayjs(next).fromNow(), calendar: dayjs(next).calendar() };
  }

  public reg<Value>(
    operation: string,
    cronTime: string,
    handler: () => Promise<StatsResult<Value> | any>,
    opts: Omit<CronJobParameters, 'cronTime' | 'onTick'> & {
      // ttl in seconds
      ttl?: number;
    } = {},
  ): CronJob {
    CronService.crons[operation] = { cronTime, nextTime: this.nextTime(cronTime) };

    if (!new FeaturesConfigure().load().cronEnable) {
      this.logger.warn(`skip ${operation} because cron was not enabled.`);
      return undefined;
    }

    const ttl = opts.ttl ?? 10;
    const enabledRedis = RedisLockProvider.instance.isEnabled();
    this.logger.debug(
      `init cron ${r({ operation, cronTime, ...this.nextTime(cronTime), opts, enabled: enabledRedis })}`,
    );
    const callPromise = () =>
      enabledRedis
        ? RedisLockProvider.instance
            .lockProcess(operation, handler, { ttl: ttl * 1000 })
            .catch((reason) => this.logger.error(`do lock process error: ${r(reason)}`, reason))
        : handler().catch((reason) => this.logger.error(`${operation} error: ${r(reason)}`, reason));

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
              this.logger.debug(`cron ${operation} success, next in ${r(event.next.fromNow)}.`);
              StatsHelper.addCronSuccessEvent(operation, event).catch((reason) =>
                this.logger.error(`cron ${operation} error: ${r(reason)}`),
              );
            }
            return result;
          })
          .catch((reason) => {
            this.logger.error(`${operation} error found: ${r(reason)}`);
            StatsHelper.addCronFailureEvent(operation, {
              cronTime,
              next: this.nextTime(cronTime),
              reason,
            }).catch((err) => this.logger.error(`addCronFailureEvent error: ${r(err)}`));
          })
          .finally(() => {
            const next = this.nextTime(cronTime);
            if (dayjs(next.next).diff(new Date(), 'minute') > 1)
              this.logger.debug(`${operation} done. ${r({ cronTime, ...next })}`);
          }),
      /*
      onComplete: () => {
        this.logger.debug(`${operation} completed.`);
        if (_.isFunction(opts.onComplete)) opts.onComplete();
      }, */
      runOnInit: false,
      start: true,
      ..._.omit(opts, 'ttl'),
    });
  }
}
