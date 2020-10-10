import { Controller, Get } from '@nestjs/common';
import {
  DiskHealthIndicator,
  DNSHealthIndicator,
  HealthCheck,
  HealthCheckService,
  MemoryHealthIndicator,
  TypeOrmHealthIndicator,
} from '@nestjs/terminus';
import * as checkDiskSpace from 'check-disk-space';
import * as _ from 'lodash';
import { dirname, resolve } from 'path';
import { getConnection } from 'typeorm';
import { r } from '../common/helpers';
import { LoggerFactory } from '../common/logger';
import { MQHealthIndicator, MQProvider, RedisHealthIndicator, RedisProvider } from '../providers';

const logger = LoggerFactory.getLogger('HealthController');

@Controller('health')
export class HealthController {
  private mq = new MQHealthIndicator();
  private redis = new RedisHealthIndicator();
  private path = resolve(dirname(process.mainModule.filename), '../..');

  // eslint-disable-next-line max-params
  public constructor(
    private health: HealthCheckService,
    private dns: DNSHealthIndicator,
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
