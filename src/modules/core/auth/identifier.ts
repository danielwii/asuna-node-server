import { IdentifierHelper } from '../../common';
import { AdminUser } from './auth.entities';
import { AuthUser } from './base.entities';

function StaticImplements<T>() {
  return (constructor: T) => {};
}

@StaticImplements<IdentifierHelper<Partial<AdminUser>>>()
export class AdminUserIdentifierHelper {
  static parse = (identifier: string): Partial<AdminUser> => ({ id: identifier.slice(1) });

  static stringify = (payload: Partial<AdminUser>): string => `admin=${payload.id}`;

  static resolve(identifier: string): { type: string; id: string } {
    return { type: identifier.split('=')[0], id: identifier.split('=')[1] };
  }

  static identify(identifier: string): boolean {
    return this.resolve(identifier).type === 'admin';
  }
}

@StaticImplements<IdentifierHelper<Partial<AuthUser>>>()
export class UserIdentifierHelper {
  static parse = (identifier: string): Partial<AuthUser> => ({ id: identifier.split('=')[1] });

  static stringify = (payload: Partial<AuthUser>): string => `u=${payload.id}`;

  static resolve(identifier: string): { type: string; id: string } {
    return { type: identifier.split('=')[0], id: identifier.split('=')[1] };
  }

  static identify(identifier: string): boolean {
    return this.resolve(identifier).type === 'u';
  }
}
