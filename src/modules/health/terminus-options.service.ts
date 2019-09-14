import { Injectable } from '@nestjs/common';
import {
  DiskHealthIndicator,
  DNSHealthIndicator,
  HealthIndicatorFunction,
  MemoryHealthIndicator,
  TerminusEndpoint,
  TerminusModuleOptions,
  TerminusOptionsFactory,
  TypeOrmHealthIndicator,
} from '@nestjs/terminus';
import { getConnection } from 'typeorm';
import { LoggerFactory } from '../common/logger';

const logger = LoggerFactory.getLogger('Terminus');

@Injectable()
export class TerminusOptionsService implements TerminusOptionsFactory {
  private static healthIndicators: HealthIndicatorFunction[] = [];

  constructor(
    private readonly dns: DNSHealthIndicator,
    private readonly typeorm: TypeOrmHealthIndicator,
    private readonly memory: MemoryHealthIndicator,
    private readonly disk: DiskHealthIndicator,
  ) {}

  public static withHealthIndicators(...indicators: HealthIndicatorFunction[]) {
    this.healthIndicators.push(...indicators);
    return this;
  }

  createTerminusOptions(): TerminusModuleOptions {
    logger.log(`init with indicators: ${JSON.stringify(TerminusOptionsService.healthIndicators)}`);
    // TODO not secured by admin auth
    const healthEndpoint: TerminusEndpoint = {
      url: '/admin/health',
      healthIndicators: [
        ...TerminusOptionsService.healthIndicators,
        async () => this.dns.pingCheck('dns', 'https://1.1.1.1'),
        async () => this.typeorm.pingCheck('database', { timeout: 1, connection: getConnection() as any }),
        /*
        async () => this.memory.checkHeap('memory_heap', 200 * 1024 * 1024),
        async () => this.memory.checkHeap('memory_heap', 200 * 1024 * 1024),
        async () => this.memory.checkRSS('memory_rss', 3000 * 1024 * 1024),
        async () =>
          this.disk.checkStorage('storage', { threshold: 10 * 1024 * 1024 * 1024, path: '/' }),*/
      ],
    };
    return {
      endpoints: [healthEndpoint],
    };
  }
}
