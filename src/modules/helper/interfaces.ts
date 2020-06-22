import { Request } from 'express';
import { AdminUser, Role } from '../core/auth/auth.entities';
import { JwtPayload } from '../core/auth/auth.interfaces';
import { UserProfile } from '../core/auth/user.entities';
import { Tenant } from '../tenant/tenant.entities';
import { WXJwtPayload } from '../wechat/interfaces';

export type PayloadType = JwtPayload | WXJwtPayload | ApiKeyPayload;
export type AuthInfo<Payload = PayloadType, User = AdminUser | any, Profile = UserProfile> = Partial<{
  payload?: Payload;
  user?: User;
  profile?: Profile;
  identifier?: string;
  tenant?: Tenant;
  roles?: Role[];
}>;
export type AnyAuthRequest<Payload = PayloadType, User = AdminUser | any, Profile = UserProfile> = Request &
  AuthInfo<Payload, User, Profile> & { clientIp: string };

export interface ApiKeyPayload {
  apiKey: string;
}

export type AuthResult<P> = { err: string | Error; payload: P; info };
