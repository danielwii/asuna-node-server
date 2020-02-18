import { Request } from 'express';
import { UserProfile } from '../core/auth';
import { AnyAuthRequest } from '../helper';
import { WXJwtPayload } from './interfaces';

export type WXAuthRequest = AnyAuthRequest<WXJwtPayload, UserProfile>;

export function isWXAuthRequest(req: Request): req is WXAuthRequest {
  const { authorization } = req.headers;
  return authorization ? authorization.startsWith('WX ') : false;
}
