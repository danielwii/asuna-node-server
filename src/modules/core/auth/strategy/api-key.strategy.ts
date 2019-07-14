import { Injectable, Logger } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Request } from 'express';
import { Strategy } from 'passport-strategy';
import { r } from '../../../common/helpers';

const logger = new Logger('ApiKeyStrategy');

const API_KEY_HEADER = 'X-ApiKey';

@Injectable()
export class ApiKeyStrategy extends PassportStrategy(Strategy, 'admin-api-key') {
  public authenticate(req: Request, options?: any): void {
    logger.log(`validate ${r(options)}`);
    const self: Strategy = this as any;
    const key = req.headers[API_KEY_HEADER] as string;
    if (key) {
      // TODO verify api key later
      self.success({ apiKey: key });
    } else {
      self.fail('ApiKey is required', 401);
    }
  }
}

export function isApiKeyRequest(req: Request) {
  return !!req.headers[API_KEY_HEADER];
}
