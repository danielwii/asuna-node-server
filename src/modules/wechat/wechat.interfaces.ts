import { UserProfile } from '../core/auth/user.entities';

import type { Request } from 'express';
import type { AnyAuthRequest } from '../helper/interfaces';
import type { WXJwtPayload } from './interfaces';

export type WXAuthRequest = AnyAuthRequest<WXJwtPayload, UserProfile>;

export function isWXAuthRequest(req: Request): req is WXAuthRequest {
  const { authorization } = req.headers;
  return authorization ? authorization.startsWith('WX ') : false;
}
