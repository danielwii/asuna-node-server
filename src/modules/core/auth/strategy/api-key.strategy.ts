import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Request } from 'express';
import { Strategy } from 'passport-strategy';
import { getIgnoreCase, r } from '../../../common/helpers';
import { LoggerFactory } from '../../../common/logger';
import { API_KEY_HEADER } from './interfaces';
import { AdminApiKeys } from '../auth.entities';

const logger = LoggerFactory.getLogger('ApiKeyStrategy');

@Injectable()
export class ApiKeyStrategy extends PassportStrategy(Strategy, 'admin-api-key') {
  async authenticate(req: Request, options?: any) {
    logger.log(`validate request with options: ${r(options)}`);
    const self: Strategy = this as any;
    const key = getIgnoreCase(req.headers, API_KEY_HEADER) as string;
    if (key) {
      const exists = await AdminApiKeys.find({ key, isPublished: true });
      if (exists) {
        return self.success({ apiKey: key });
      }
    }
    logger.error(`invalid api key: '${key}'`);
    self.fail('ApiKey is required', 401);
  }
}
