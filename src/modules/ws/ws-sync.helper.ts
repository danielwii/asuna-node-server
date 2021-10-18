import { CronExpression } from '@nestjs/schedule';

import { LoggerFactory } from '@danielwii/asuna-helper/dist/logger/factory';
import { r } from '@danielwii/asuna-helper/dist/serializer';

import * as _ from 'lodash';

import { InMemoryDB } from '../cache/db';
import { CronHelper } from '../helper/cron';
import { StatsHelper } from '../stats';
import { AdminWsHelper } from './socket-io.gateway';

import type { Server } from 'socket.io';

const logger = LoggerFactory.getLogger('AdminWsSyncHelper');

export class AdminWsSyncHelper {
  static get ws(): Server {
    return AdminWsHelper.ws;
  }

  static sentStats = {};

  static initCron(): void {
    CronHelper.reg(
      'sync-ws',
      CronExpression.EVERY_10_SECONDS,
      async () => {
        const stats = await InMemoryDB.get(`error-stats`);
        const diff = _.omitBy(stats, (value, key) => AdminWsSyncHelper.sentStats?.[key] === value);
        if (!_.isEmpty(diff)) {
          logger.debug(`diff ${r({ diff, stats, sent: AdminWsSyncHelper.sentStats })}`);
          AdminWsSyncHelper.sentStats = stats;
          const results = await Promise.all(
            _.map([...StatsHelper.keys], async (key) => {
              const errors = await InMemoryDB.list({ prefix: 'stats', key });
              AdminWsSyncHelper.syncToClient(key, errors);
            }),
          );
          return { stats: { count: results.length, keys: StatsHelper.keys } };
        }
        return {};
      },
      { start: true },
    );
  }

  static syncToClient(type: string, payload): void {
    const event = 'sync';
    this.ws.emit(event, { type, payload });
  }
}
