import { Injectable, Logger } from '@nestjs/common';
import { HealthCheckError, HealthIndicator, HealthIndicatorResult } from '@nestjs/terminus';

import { resolveModule } from '@danielwii/asuna-helper/dist/logger/factory';
import { RedisProvider } from '@danielwii/asuna-helper/dist/providers/redis/provider';
import { r } from '@danielwii/asuna-helper/dist/serializer';

const logger = new Logger(resolveModule(__filename, 'RedisHealthIndicator'));

@Injectable()
export class RedisHealthIndicator extends HealthIndicator {
  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    const redisClientObject = RedisProvider.getRedisClient();
    const isHealthy = redisClientObject.client.isOpen;

    const status = this.getStatus(key, isHealthy, {
      message: !isHealthy ? 'redis is unhealthy' : undefined,
      // enabled: redisClientObject.isEnabled,
      // isHealthy: isHealthy,
      // config: redisClientObject.redisOptions,
    });

    if (isHealthy) {
      return status;
    }

    logger.error(`redis is unhealthy ${r(redisClientObject)}`);
    throw new HealthCheckError('RedisCheck failed', status);
  }
}
