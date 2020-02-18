import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Request } from 'express';
import { Strategy } from 'passport-strategy';
import { getIgnoreCase, r } from '../../../common/helpers';
import { LoggerFactory } from '../../../common/logger';
import { API_KEY_HEADER } from './interfaces';

const logger = LoggerFactory.getLogger('ApiKeyStrategy');

@Injectable()
export class ApiKeyStrategy extends PassportStrategy(Strategy, 'admin-api-key') {
  public authenticate(req: Request, options?: any): void {
    logger.log(`validate request with options: ${r(options)}`);
    const self: Strategy = this as any;
    const key = getIgnoreCase(req.headers, API_KEY_HEADER) as string;
    if (key) {
      // TODO verify api key later
      logger.warn(`skipped api-key validation... '${key}'`);
      self.success({ apiKey: key }, null);
    } else {
      self.fail('ApiKey is required', 401);
    }
  }
}
