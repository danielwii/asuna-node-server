import { AuthUserChannel } from './base.entities';

export interface JwtPayload {
  uid: string;
  id: string;
  email: string;
  username: string;
  channel: AuthUserChannel;
  iat: number;
  exp: number;
}
