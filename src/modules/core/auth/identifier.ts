import { StaticImplements } from '@danielwii/asuna-helper/dist/types';

import type { IdentifierHelper, PrimaryKey } from '../../common/identifier';

@StaticImplements<IdentifierHelper<Partial<{ id: PrimaryKey }>>>()
export class AdminUserIdentifierHelper {
  static parse = (identifier: string): Partial<{ id: PrimaryKey }> => ({ id: identifier.slice(1) });

  static stringify = (payload: Partial<{ id: PrimaryKey }>): string => `admin=${payload.id}`;

  static resolve(identifier: string): { type: string; id: PrimaryKey } {
    return { type: identifier.split('=')[0], id: identifier.split('=')[1] };
  }

  static identify(identifier: string): boolean {
    return AdminUserIdentifierHelper.resolve(identifier).type === 'admin';
  }
}

@StaticImplements<IdentifierHelper<Partial<{ id: PrimaryKey }>>>()
export class UserIdentifierHelper {
  static parse = (identifier: string): Partial<{ id: PrimaryKey }> => ({ id: identifier.split('=')[1] });

  static stringify = (payload: Partial<{ id: PrimaryKey }>): string => `u=${payload.id ?? ''}`;

  static resolve(identifier: string): { type: string; id: PrimaryKey } {
    return { type: identifier.split('=')[0], id: identifier.split('=')[1] };
  }

  static identify(identifier: string): boolean {
    return UserIdentifierHelper.resolve(identifier).type === 'u';
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
    return this.resolve(identifier).type === 'p';
  }
}

@StaticImplements<IdentifierHelper<Partial<{ id: string }>>>()
export class OrgUserProfileIdentifierHelper {
  static parse = (identifier: string): Partial<{ id: string }> => ({ id: identifier.split('=')[1] });

  static stringify = (payload: Partial<{ id: string }>): string => `org=${payload.id}`;

  static resolve(identifier: string): { type: string; id: string } {
    return { type: identifier.split('=')[0], id: identifier.split('=')[1] };
  }

  static identify(identifier: string): boolean {
    return this.resolve(identifier).type === 'org';
  }
}

@StaticImplements<IdentifierHelper<Partial<{ id: number }>>>()
export class ApiKeyIdentifierHelper {
  static parse = (identifier: string): Partial<{ id: number }> => ({ id: +identifier.split('=')[1] });

  static stringify = (payload: Partial<{ id: number }>): string => `key=${payload.id}`;

  static resolve(identifier: string): { type: string; id: number } {
    return { type: identifier.split('=')[0], id: +identifier.split('=')[1] };
  }

  static identify(identifier: string): boolean {
    return this.resolve(identifier).type === 'key';
  }
}
