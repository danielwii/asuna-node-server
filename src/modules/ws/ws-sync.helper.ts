import { CronExpression } from '@nestjs/schedule';
import * as _ from 'lodash';
import { Server } from 'socket.io';
import { InMemoryDB } from '../cache/db';
import { r } from '../common/helpers/utils';
import { LoggerFactory } from '../common/logger';
import { CronHelper } from '../helper';
import { StatsHelper } from '../stats';
import { AdminWsHelper } from './socket-io.gateway';

const logger = LoggerFactory.getLogger('AdminWsSyncHelper');

export class AdminWsSyncHelper {
  static get ws(): Server {
    return AdminWsHelper.ws;
  }

  static sentStats = {};

  static initCron(): void {
    CronHelper.reg(
      'sync-ws',
      CronExpression.EVERY_15_SECONDS,
      async () => {
        const stats = await InMemoryDB.get(`error-stats`);
        const diff = _.omitBy(stats, (value, key) => AdminWsSyncHelper.sentStats?.[key] === value);
        if (_.isEmpty(diff)) {
          logger.verbose(`diff ${r({ diff, stats, sent: AdminWsSyncHelper.sentStats })}`);
          AdminWsSyncHelper.sentStats = stats;
          const results = await Promise.all(
            _.map([...StatsHelper.keys], async (key) => {
              const errors = await InMemoryDB.list({ prefix: 'stats', key });
              AdminWsSyncHelper.syncToClient(key, errors);
            }),
          );
          return { stats: { count: results.length, keys: StatsHelper.keys } };
        }
        return null;
      },
      { start: true },
    );
  }

  static syncToClient(type: string, payload): void {
    const event = 'sync';
    this.ws.emit(event, { type, payload });
  }
}
