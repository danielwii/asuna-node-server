import type { Request } from 'express';
import type { CommonRequest } from '../common';
import type { AdminUser, JwtPayload, Role, UserProfile } from '../core/auth';
import type { Tenant } from '../tenant';
import type { WXJwtPayload } from '../wechat';
import type { ApiKeyRequest } from '../core/auth/strategy';

export type PayloadType = JwtPayload | WXJwtPayload | ApiKeyPayload;
export type AuthInfo<Payload = PayloadType, User = AdminUser | any, Profile = UserProfile> = Partial<{
  payload?: Payload;
  user?: User;
  profile?: Profile;
  identifier?: string;
  tenant?: Tenant;
  roles?: Role[];
}>;
export type RequestInfo = Request & CommonRequest & ApiKeyRequest & { isOrgUser?: boolean; clientIp: string };
export type AnyAuthRequest<Payload = PayloadType, User = AdminUser | any, Profile = UserProfile> = RequestInfo &
  AuthInfo<Payload, User, Profile> & { clientIp: string };

export interface ApiKeyPayload {
  apiKey: string;
}

export interface AuthResult<P> {
  err: string | Error;
  payload: P;
  info: any;
}
