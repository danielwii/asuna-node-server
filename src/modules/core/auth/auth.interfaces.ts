import { PrimaryKey } from '../../common/identifier';

export interface IJwtPayload {
  id: PrimaryKey;
  email: string;
  username: string;
  iat: number;
  exp: number;
}
