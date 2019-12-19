import { PrimaryKey } from '../../common/identifier';
import { AuthUserType } from './base.entities';

export interface IJwtPayload {
  id: PrimaryKey;
  email: string;
  username: string;
  type: AuthUserType;
  iat: number;
  exp: number;
}
