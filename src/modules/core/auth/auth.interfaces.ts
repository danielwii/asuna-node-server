export interface IJwtPayload {
  id: number | string;
  email: string;
  username: string;
  iat: number;
  exp: number;
}
