import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Request } from 'express';
import { Strategy } from 'passport-strategy';
import { getIgnoreCase, r } from '../../../common/helpers';
import { LoggerFactory } from '../../../common/logger';

const logger = LoggerFactory.getLogger('ApiKeyStrategy');

const API_KEY_HEADER = 'X-ApiKey';

@Injectable()
export class ApiKeyStrategy extends PassportStrategy(Strategy, 'admin-api-key') {
  public authenticate(req: Request, options?: any): void {
    logger.log(`validate request with options: ${r(options)}`);
    const self: Strategy = this as any;
    const key = getIgnoreCase(req.headers, API_KEY_HEADER) as string;
    if (key) {
      // TODO verify api key later
      logger.warn(`skipped api-key validation... '${key}'`);
      self.success({ apiKey: key });
    } else {
      self.fail('ApiKey is required', 401);
    }
  }
}

export function isApiKeyRequest(req: Request) {
  return !!getIgnoreCase(req.headers, API_KEY_HEADER);
}
