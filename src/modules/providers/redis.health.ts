import { Injectable } from '@nestjs/common';
import { HealthCheckError, HealthIndicator, HealthIndicatorResult } from '@nestjs/terminus';

import { LoggerFactory } from '@danielwii/asuna-helper/dist/logger';
import { r } from '@danielwii/asuna-helper/dist/serializer';

import { RedisProvider } from './redis.provider';

const logger = LoggerFactory.getLogger('RedisHealthIndicator');

@Injectable()
export class RedisHealthIndicator extends HealthIndicator {
  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    const redisClientObject = RedisProvider.instance.getRedisClient();
    const isHealthy = redisClientObject.isHealthy;

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
