import { Injectable, Logger } from '@nestjs/common';
import { HealthCheckError, HealthIndicator, HealthIndicatorResult } from '@nestjs/terminus';

import { resolveModule } from '@danielwii/asuna-helper/dist/logger/factory';
import { RedisProvider } from '@danielwii/asuna-helper/dist/providers/redis/provider';
import { r } from '@danielwii/asuna-helper/dist/serializer';
import { fileURLToPath } from "url";

@Injectable()
export class RedisHealthIndicator extends HealthIndicator {
  private readonly logger = new Logger(resolveModule(fileURLToPath(import.meta.url), RedisHealthIndicator.name));

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

    this.logger.error(`redis is unhealthy ${r(redisClientObject)}`);
    throw new HealthCheckError('RedisCheck failed', status);
  }
}
