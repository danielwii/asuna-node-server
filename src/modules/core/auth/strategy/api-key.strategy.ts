import { ForbiddenException, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';

import { resolveModule } from '@danielwii/asuna-helper/dist/logger/factory';
import { r } from '@danielwii/asuna-helper/dist/serializer';

import { fileURLToPath } from 'node:url';

import _ from 'lodash';
import { Strategy } from 'passport-strategy';

import { getIgnoreCase } from '../../../common/helpers/normal';
import { AdminApiKey } from '../auth.entities';
import { API_KEY_HEADER, ApiKeyRequest } from './interfaces';

import type { Request } from 'express';

@Injectable()
export class ApiKeyStrategy extends PassportStrategy(Strategy, 'api-key') {
  private readonly logger = new Logger(resolveModule(fileURLToPath(import.meta.url), this.constructor.name));

  public override async authenticate(req: Request & ApiKeyRequest, options?: any): Promise<void> {
    const key = getIgnoreCase(req.headers, API_KEY_HEADER) as string;
    this.logger.debug(`validate request with options: ${r({ options, key })}`);

    if (_.isNil(key)) {
      return this.error(new UnauthorizedException());
    } else {
      const exists = await AdminApiKey.findOneBy({ key, isPublished: true });
      this.logger.verbose(`found api key: ${r(exists)}`);
      if (exists) {
        this.logger.log(`api key request: '${exists.name}'`);
        if (!_.includes(exists.whitelist, req.ip) && !_.includes(exists.whitelist, '*')) {
          return this.error(new ForbiddenException(`${req.ip} no in whitelist`));
        }
        req.isApiKeyRequest = true;
        req.apiKey = exists;
        return this.success({ apiKey: key });
      }
      this.logger.error(`invalid api key: '${key}'`);
      // this.fail('Invalid ApiKey', 403);
      return this.error(new UnauthorizedException('invalid api key'));
    }
  }
}
