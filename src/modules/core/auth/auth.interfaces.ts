import { PrimaryKey } from '../../common/identifier';
import { AuthUserChannel } from './base.entities';

export interface JwtPayload {
  id: PrimaryKey;
  email: string;
  username: string;
  type: AuthUserChannel;
  iat: number;
  exp: number;
}
