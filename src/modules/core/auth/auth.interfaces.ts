import type { AuthUserChannel } from './base.entities';

export type JwtPayload = {
  /**
   * 仅在指代 UserProfile 指向一个 User 时的 id
   */
  uid?: string;

  id: string;
  email: string;
  username: string;
  channel: AuthUserChannel;

  type: string;
} & {
  iat: number;
  exp: number;
};
