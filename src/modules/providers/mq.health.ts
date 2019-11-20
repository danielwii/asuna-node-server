import { HealthCheckError } from '@godaddy/terminus';
import { Injectable } from '@nestjs/common';
import { HealthIndicator, HealthIndicatorResult } from '@nestjs/terminus';
import { MQProvider } from './mq.provider';

@Injectable()
export class MQHealthIndicator extends HealthIndicator {
  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    const {instance} = MQProvider;
    const isHealthy = MQProvider.enabled;

    const result = this.getStatus(key, isHealthy, {
      enabled: MQProvider.enabled,
      // isHealthy: mqClientObject.isHealthy,
      // config: mqClientObject.mqOptions,
    });

    if (isHealthy) {
      return result;
    }
    throw new HealthCheckError('MQCheck failed', result);
  }
}
