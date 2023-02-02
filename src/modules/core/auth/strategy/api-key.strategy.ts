import { Injectable, Logger } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';

import { resolveModule } from '@danielwii/asuna-helper/dist/logger/factory';
import { r } from '@danielwii/asuna-helper/dist/serializer';

import _ from 'lodash';
import { fileURLToPath } from 'node:url';
import { Strategy } from 'passport-strategy';

import { getIgnoreCase } from '../../../common/helpers/normal';
import { AdminApiKeys } from '../auth.entities';
import { API_KEY_HEADER, ApiKeyRequest } from './interfaces';

import type { Request } from 'express';

@Injectable()
export class ApiKeyStrategy extends PassportStrategy(Strategy, 'admin-api-key') {
  private readonly logger = new Logger(resolveModule(fileURLToPath(import.meta.url), this.constructor.name));

  public override async authenticate(req: Request & ApiKeyRequest, options?: any): Promise<void> {
    const self: Strategy = this as any;
    const key = getIgnoreCase(req.headers, API_KEY_HEADER) as string;
    this.logger.debug(`validate request with options: ${r({ options, key })}`);
    if (_.isNil(key)) {
      self.fail('ApiKey is required', 401);
    } else {
      const exists = await AdminApiKeys.findOneBy({ key, isPublished: true });
      this.logger.verbose(`found api key: ${r(exists)}`);
      if (exists) {
        req.isApiKeyRequest = true;
        return self.success({ apiKey: key });
      }
      this.logger.error(`invalid api key: '${key}'`);
      self.fail('Invalid ApiKey', 403);
    }
  }
}
