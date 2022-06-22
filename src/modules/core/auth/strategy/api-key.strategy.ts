import { Injectable, Logger } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';

import { resolveModule } from '@danielwii/asuna-helper/dist/logger/factory';
import { r } from '@danielwii/asuna-helper/dist/serializer';

import _ from 'lodash';
import { Strategy } from 'passport-strategy';

import { getIgnoreCase } from '../../../common/helpers';
import { AdminApiKeys } from '../auth.entities';
import { API_KEY_HEADER, ApiKeyRequest } from './interfaces';

import type { Request } from 'express';

const logger = new Logger(resolveModule(__filename, 'ApiKeyStrategy'));

@Injectable()
export class ApiKeyStrategy extends PassportStrategy(Strategy, 'admin-api-key') {
  public async authenticate(req: Request & ApiKeyRequest, options?: any) {
    const self: Strategy = this as any;
    const key = getIgnoreCase(req.headers, API_KEY_HEADER) as string;
    logger.log(`validate request with options: ${r(options)} key: ${key}`);
    if (_.isNil(key)) {
      self.fail('ApiKey is required', 401);
    } else {
      const exists = await AdminApiKeys.findOneBy({ key, isPublished: true });
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
