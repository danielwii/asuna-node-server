import { Request } from 'express';
import { AdminUser, Role } from '../core/auth/auth.entities';
import { JwtPayload } from '../core/auth/auth.interfaces';
import { UserProfile } from '../core/auth/user.entities';
import { Tenant } from '../tenant/tenant.entities';
import { WXJwtPayload } from '../wechat/interfaces';

export type PayloadType = JwtPayload | WXJwtPayload | ApiKeyPayload;
export type AuthInfo<P = PayloadType, U = UserProfile | AdminUser> = Partial<{
  payload: P;
  user: U;
  identifier: string;
  tenant?: Tenant;
  roles?: Role[];
}>;
export type AnyAuthRequest<P = PayloadType, U = UserProfile | AdminUser> = Request & AuthInfo<P, U>;

export interface ApiKeyPayload {
  apiKey: string;
}

export type AuthResult<P> = { err: string | Error; payload: P; info };
