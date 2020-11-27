import * as passport from 'passport';

import { r } from '../common/helpers/utils';
import { LoggerFactory } from '../common/logger';
import { wrapErrorInfo } from '../helper/utils';
import { OrgUser } from './tenant.entities';

import type { Response } from 'express';
import type { AnyAuthRequest, AuthResult } from '../helper/interfaces';
import type { JwtPayload } from '../core/auth/auth.interfaces';

export type OrgJwtAuthRequest<User = OrgUser> = AnyAuthRequest<JwtPayload, User>;

const logger = LoggerFactory.getLogger('AuthHelper');

export class OrgAuthHelper {
  public static async populate(req: OrgJwtAuthRequest, payload: JwtPayload): Promise<void> {
    // TODO user not include tenant and roles, only admin-user has currently
    const user = await OrgUser.findOne(payload.id, { relations: ['tenant'] });
    logger.debug(`jwt user ${r(user)}`);
    // req.identifier = UserIdentifierHelper.stringify(payload);
    req.isOrgUser = true;
    req.payload = payload;
    // req.profile = user.profile;
    req.user = user;
    req.tenant = user.tenant;
    // req.roles = user.roles;
  }

  public static auth(req: OrgJwtAuthRequest, res: Response): Promise<AuthResult<JwtPayload>> {
    return new Promise((resolve) => {
      passport.authenticate('org-jwt', { session: false, authInfo: true }, async (err, payload: JwtPayload, info) => {
        logger.log(`jwt auth ${r({ payload })}`);
        if (err || info) {
          logger.warn(`jwt auth error: ${r(err)}`);
        } else {
          await OrgAuthHelper.populate(req, payload);
        }
        resolve({ err: err || wrapErrorInfo(info), payload, info });
      })(req, res);
    });
  }
}
