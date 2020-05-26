import { Injectable } from '@nestjs/common';
import { HealthCheckError, HealthIndicator, HealthIndicatorResult } from '@nestjs/terminus';
import { MQProvider } from './mq.provider';

@Injectable()
export class MQHealthIndicator extends HealthIndicator {
  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    const isHealthy = MQProvider.isHealthy;

    const status = this.getStatus(key, isHealthy, { message: isHealthy ? undefined : 'mq is unhealthy' });

    if (isHealthy) {
      return status;
    }
    throw new HealthCheckError('MQCheck failed', status);
  }
}
