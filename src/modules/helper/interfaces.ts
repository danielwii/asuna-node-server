import type { Request } from 'express';
import type { AdminUser, JwtPayload, Role, UserProfile } from '../core/auth';
import type { Tenant } from '../tenant';
import type { WXJwtPayload } from '../wechat';
import type { CommonRequest } from '../common';

export type PayloadType = JwtPayload | WXJwtPayload | ApiKeyPayload;
export type AuthInfo<Payload = PayloadType, User = AdminUser | any, Profile = UserProfile> = Partial<{
  payload?: Payload;
  user?: User;
  profile?: Profile;
  identifier?: string;
  tenant?: Tenant;
  roles?: Role[];
}>;
export type RequestInfo = Request & CommonRequest;
export type AnyAuthRequest<Payload = PayloadType, User = AdminUser | any, Profile = UserProfile> = RequestInfo &
  AuthInfo<Payload, User, Profile> & { clientIp: string };

export interface ApiKeyPayload {
  apiKey: string;
}

export type AuthResult<P> = { err: string | Error; payload: P; info: any };
