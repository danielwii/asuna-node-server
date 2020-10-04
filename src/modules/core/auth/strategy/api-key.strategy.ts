import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Request } from 'express';
import { Strategy } from 'passport-strategy';
import * as _ from 'lodash';
import { getIgnoreCase, r } from '../../../common/helpers';
import { LoggerFactory } from '../../../common/logger';
import { API_KEY_HEADER, ApiKeyRequest } from './interfaces';
import { AdminApiKeys } from '../auth.entities';

const logger = LoggerFactory.getLogger('ApiKeyStrategy');

@Injectable()
export class ApiKeyStrategy extends PassportStrategy(Strategy, 'admin-api-key') {
  public async authenticate(req: Request & ApiKeyRequest, options?: any) {
    const self: Strategy = this as any;
    const key = getIgnoreCase(req.headers, API_KEY_HEADER) as string;
    logger.log(`validate request with options: ${r(options)} key: ${key}`);
    if (_.isNil(key)) {
      self.fail('ApiKey is required', 401);
    } else {
      const exists = await AdminApiKeys.findOne({ key, isPublished: true });
      logger.verbose(`found api key: ${r(exists)}`);
      if (exists) {
        req.isApiKeyRequest = true;
        return self.success({ apiKey: key });
      }
      logger.error(`invalid api key: '${key}'`);
      self.fail('Invalid ApiKey', 403);
    }
  }
}
