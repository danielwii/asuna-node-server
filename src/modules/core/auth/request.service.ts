import { Injectable, Logger } from '@nestjs/common';

import { AsunaErrorCode, AsunaException } from '@danielwii/asuna-helper/dist/exceptions';
import { resolveModule } from '@danielwii/asuna-helper/dist/logger/factory';
import { r } from '@danielwii/asuna-helper/dist/serializer';

import _ from 'lodash';
import { fileURLToPath } from 'node:url';
import passport from 'passport';

import { AuthHelper, AuthType, isAdminAuthRequest, isOrgAuthRequest } from '../../helper/auth';
import { wrapErrorInfo } from '../../helper/utils';
import { OrgAuthHelper } from '../../tenant/auth';
import { isWXAuthRequest } from '../../wechat/wechat.interfaces';
import { isApiKeyRequest } from './strategy/interfaces';

import type { Response } from 'express';
import type { AnyAuthRequest, ApiKeyPayload, AuthResult, PayloadType } from '../../helper/interfaces';
import type { AdminUser } from './auth.entities';
import type { JwtPayload } from './auth.interfaces';

@Injectable()
export class RequestAuthService {
  private readonly logger = new Logger(resolveModule(fileURLToPath(import.meta.url), this.constructor.name));

  public async auth<Payload = PayloadType>(
    req: AnyAuthRequest<Payload>,
    res: Response,
    type: AuthType = AuthType.all,
  ): Promise<AuthResult<Payload>> {
    this.logger.debug(
      `auth ${r({
        type,
        isApiKeyRequest: isApiKeyRequest(req),
        isAdminAuthRequest: isAdminAuthRequest(req),
        isWXAuthRequest: isWXAuthRequest(req),
        isOrgAuthRequest: isOrgAuthRequest(req),
      })}`,
    );

    if (_.includes([AuthType.admin, AuthType.all], type)) {
      if (isApiKeyRequest(req)) {
        return (await this.authAdminApiKey(req, res)) as any;
      }

      if (isAdminAuthRequest(req)) {
        return (await AuthHelper.authAdmin(req, res)) as any;
      }
    }

    if (_.includes([AuthType.org, AuthType.all], type)) {
      if (isOrgAuthRequest(req)) {
        return (await OrgAuthHelper.auth(req, res)) as any;
      }
    }

    if (_.includes([AuthType.client, AuthType.all], type)) {
      if (isWXAuthRequest(req)) {
        return (await AuthHelper.authWX(req, res)) as any;
      }
      return (await AuthHelper.authJwt(req as any as AnyAuthRequest<JwtPayload, AdminUser>, res)) as any;
    }

    throw new AsunaException(AsunaErrorCode.InvalidCredentials);
  }

  public async authAdminApiKey(req: AnyAuthRequest<ApiKeyPayload>, res: Response): Promise<AuthResult<ApiKeyPayload>> {
    return new Promise((resolve) => {
      passport.authenticate('admin-api-key', { session: false }, (err, payload: ApiKeyPayload, info) => {
        this.logger.log(`admin-api-key auth: ${r({ err, payload, info })}`);
        if (err || info) {
          this.logger.error(`api-key auth error: ${r({ err, info })}`);
        } else {
          req.payload = payload;
          req.identifier = `api-key=${payload.apiKey}`; // { apiKey: xxx }
        }
        resolve({ err: err ?? wrapErrorInfo(info), payload, info });
      })(req, res);
    });
  }
}
