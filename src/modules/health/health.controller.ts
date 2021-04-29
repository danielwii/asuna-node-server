import { Controller, Get } from '@nestjs/common';
import {
  DiskHealthIndicator,
  HealthCheck,
  HealthCheckService,
  HttpHealthIndicator,
  MemoryHealthIndicator,
  TypeOrmHealthIndicator,
} from '@nestjs/terminus';

import { LoggerFactory } from '@danielwii/asuna-helper/dist/logger';
import { RedisProvider } from '@danielwii/asuna-helper/dist/providers/redis/provider';
import { r } from '@danielwii/asuna-helper/dist/serializer';

import checkDiskSpace from 'check-disk-space';
import _ from 'lodash';
import { dirname, resolve } from 'path';
import { getConnection } from 'typeorm';

import { MQHealthIndicator, MQProvider, RedisHealthIndicator } from '../providers';

const logger = LoggerFactory.getLogger('HealthController');

@Controller('health')
export class HealthController {
  private mq = new MQHealthIndicator();
  private redis = new RedisHealthIndicator();
  private path = resolve(dirname(require.main.filename), '../..');

  // eslint-disable-next-line max-params
  public constructor(
    private health: HealthCheckService,
    private dns: HttpHealthIndicator,
    private typeorm: TypeOrmHealthIndicator,
    private memory: MemoryHealthIndicator,
    private disk: DiskHealthIndicator,
  ) {}

  @Get()
  @HealthCheck()
  public async healthCheck() {
    const diskSpace = await checkDiskSpace(this.path);
    logger.debug(`check disk path ${r({ path: this.path, diskSpace })}`);
    return this.health.check(
      _.compact([
        async () => this.dns.pingCheck('dns', 'https://1.1.1.1'),
        async () => this.typeorm.pingCheck('database', { timeout: 1000, connection: getConnection() }),
        async () => this.memory.checkHeap('memory_heap', 1024 * 1024 * 1024),
        async () => this.memory.checkRSS('memory_rss', 3072 * 1024 * 1024),
        async () => this.disk.checkStorage('storage', { thresholdPercent: 0.95, path: this.path }),
        MQProvider.enabled ? async () => this.mq.isHealthy('mq') : undefined,
        RedisProvider.instance.getRedisClient().isEnabled ? async () => this.redis.isHealthy('redis') : undefined,
      ]),
    );
  }
}
