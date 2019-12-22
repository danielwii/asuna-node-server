import { PrimaryKey } from '../../common/identifier';
import { AuthUserType } from './base.entities';

export interface JwtPayload {
  id: PrimaryKey;
  email: string;
  username: string;
  type: AuthUserType;
  iat: number;
  exp: number;
}
