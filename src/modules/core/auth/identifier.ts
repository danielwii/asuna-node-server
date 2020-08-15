import { IdentifierHelper, PrimaryKey, StaticImplements } from '../../common';

@StaticImplements<IdentifierHelper<Partial<{ id: PrimaryKey }>>>()
export class AdminUserIdentifierHelper {
  static parse = (identifier: string): Partial<{ id: PrimaryKey }> => ({ id: identifier.slice(1) });

  static stringify = (payload: Partial<{ id: PrimaryKey }>): string => `admin=${payload.id}`;

  static resolve(identifier: string): { type: string; id: PrimaryKey } {
    return { type: identifier.split('=')[0], id: identifier.split('=')[1] };
  }

  static identify(identifier: string): boolean {
    return this.resolve(identifier).type === 'admin';
  }
}

@StaticImplements<IdentifierHelper<Partial<{ id: PrimaryKey }>>>()
export class UserIdentifierHelper {
  static parse = (identifier: string): Partial<{ id: PrimaryKey }> => ({ id: identifier.split('=')[1] });

  static stringify = (payload: Partial<{ id: PrimaryKey }>): string => `u=${payload.id}`;

  static resolve(identifier: string): { type: string; id: PrimaryKey } {
    return { type: identifier.split('=')[0], id: identifier.split('=')[1] };
  }

  static identify(identifier: string): boolean {
    return this.resolve(identifier).type === 'u';
  }
}

@StaticImplements<IdentifierHelper<Partial<{ id: string }>>>()
export class UserProfileIdentifierHelper {
  static parse = (identifier: string): Partial<{ id: string }> => ({ id: identifier.split('=')[1] });

  static stringify = (payload: Partial<{ id: string }>): string => `p=${payload.id}`;

  static resolve(identifier: string): { type: string; id: string } {
    return { type: identifier.split('=')[0], id: identifier.split('=')[1] };
  }

  static identify(identifier: string): boolean {
    return this.resolve(identifier).type === 'u';
  }
}
