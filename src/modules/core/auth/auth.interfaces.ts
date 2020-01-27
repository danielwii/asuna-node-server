import { PrimaryKey } from '../../common/identifier';
import { AuthUserChannel } from './base.entities';

export interface JwtPayload {
  uid: PrimaryKey;
  id: string;
  email: string;
  username: string;
  channel: AuthUserChannel;
  iat: number;
  exp: number;
}
