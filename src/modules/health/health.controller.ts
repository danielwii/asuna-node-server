import { Controller, Get } from '@nestjs/common';
import {
  DiskHealthIndicator,
  HealthCheck,
  HealthCheckService,
  HttpHealthIndicator,
  MemoryHealthIndicator,
  TypeOrmHealthIndicator,
} from '@nestjs/terminus';

import { LoggerFactory } from '@danielwii/asuna-helper/dist/logger/factory';

import checkDiskSpace from 'check-disk-space';
import _ from 'lodash';
import { dirname, resolve } from 'path';
import { getConnection } from 'typeorm';

import { MQHealthIndicator, MQProvider, RedisHealthIndicator } from '../providers';

const logger = LoggerFactory.getLogger('HealthController');

@Controller('health')
export class HealthController {
  // private mq = new MQHealthIndicator();
  // private redis = new RedisHealthIndicator();
  // private path = resolve(dirname(require.main.filename), '../..');

  // eslint-disable-next-line max-params
  public constructor(private health: HealthCheckService) // private http: HttpHealthIndicator,
  // private memory: MemoryHealthIndicator,
  // private typeorm: TypeOrmHealthIndicator,
  // private disk: DiskHealthIndicator,
  {}

  @Get()
  @HealthCheck()
  public async healthCheck() {
    // const diskSpace = await checkDiskSpace(this.path);
    // logger.debug(`check disk path ${r({ path: this.path, diskSpace })}`);
    return this.health.check(
      _.compact([
        // () => this.dns.pingCheck('dns', 'https://1.1.1.1'),
        // () => this.typeorm.pingCheck('database', { timeout: 1000, connection: getConnection() }),
        // () => this.memory.checkHeap('memory_heap', 1024 * 1024 * 1024),
        // () => this.memory.checkRSS('memory_rss', 3072 * 1024 * 1024),
        // () => this.disk.checkStorage('storage', { thresholdPercent: 0.95, path: this.path }),
        // MQProvider.enabled ? async () => this.mq.isHealthy('mq') : undefined,
        // RedisProvider.getRedisClient().isEnabled ? async () => this.redis.isHealthy('redis') : undefined,
      ]),
    );
  }
}
