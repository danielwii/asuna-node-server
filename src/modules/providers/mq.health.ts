import { HealthCheckError } from '@godaddy/terminus';
import { Injectable } from '@nestjs/common';
import { HealthIndicator, HealthIndicatorResult } from '@nestjs/terminus';
import { MQProvider } from './mq.provider';

@Injectable()
export class MQHealthIndicator extends HealthIndicator {
  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    const isHealthy = MQProvider.enabled;

    const result = this.getStatus(key, isHealthy, { enabled: MQProvider.enabled });

    if (isHealthy) {
      return result;
    }
    throw new HealthCheckError('MQCheck failed', result);
  }
}
