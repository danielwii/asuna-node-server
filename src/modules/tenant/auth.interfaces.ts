import type { OrgUser } from './tenant.entities';

interface OrgJwtPayload {
  uid?: string;
  id: string;
  email: string;
  username: string;
  // user: OrgUser,
  // channel: AuthUserChannel;
  iat: number;
  exp: number;
}
