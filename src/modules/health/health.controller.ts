import { Controller, Get } from '@nestjs/common';
import {
  DiskHealthIndicator,
  HealthCheck,
  HealthCheckService,
  MemoryHealthIndicator,
  TypeOrmHealthIndicator,
} from '@nestjs/terminus';

import _ from 'lodash';

import { RedisHealthIndicator } from '../providers';

@Controller('health')
export class HealthController {
  // private mq = new MQHealthIndicator();
  private redis = new RedisHealthIndicator();
  // private path = resolve(dirname(require.main.filename), '../..');

  // eslint-disable-next-line max-params
  public constructor(
    private health: HealthCheckService,
    // private http: HttpHealthIndicator,
    private memory: MemoryHealthIndicator,
    private disk: DiskHealthIndicator,
    private typeorm: TypeOrmHealthIndicator,
  ) {}

  @Get()
  @HealthCheck()
  public async healthCheck() {
    // const diskSpace = await checkDiskSpace(this.path);
    // logger.debug(`check disk path ${r({ path: this.path, diskSpace })}`);
    const memoryLimit = Number(process.env.MEM_LIMIT ?? 1024);
    const size = memoryLimit * 1024 * 1024;
    return this.health.check(
      _.compact([
        // () => this.http.pingCheck('http', 'https://1.1.1.1'),
        // () => this.memory.checkHeap('memory_heap', size),
        () => this.memory.checkRSS('memory_rss', size),
        () => this.disk.checkStorage('storage', { thresholdPercent: 0.95, path: '/' }),
        () => this.redis.isHealthy('redis'),
        () => this.typeorm.pingCheck('db'),
        // MQProvider.enabled ? async () => this.mq.isHealthy('mq') : undefined,
        // RedisProvider.getRedisClient().isEnabled ? async () => this.redis.isHealthy('redis') : undefined,
      ]),
    );
  }
}
