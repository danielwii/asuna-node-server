import { HealthCheckError } from '@godaddy/terminus';
import { Injectable } from '@nestjs/common';
import { HealthIndicator, HealthIndicatorResult } from '@nestjs/terminus';
import { RedisProvider } from 'asuna-node-server';

@Injectable()
export class RedisHealthIndicator extends HealthIndicator {
  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    const redisClientObject = RedisProvider.instance.getRedisClient();
    const isHealthy = !redisClientObject.isEnabled || redisClientObject.isHealthy;

    const result = this.getStatus(key, isHealthy, {
      enabled: redisClientObject.isEnabled,
      isHealthy: redisClientObject.isHealthy,
      config: redisClientObject.redisOptions,
    });

    if (isHealthy) {
      return result;
    }
    throw new HealthCheckError('RedisCheck failed', result);
  }
}
