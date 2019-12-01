import { Identifier, IdentifierHelper, IdentifierStatic } from '../../common';
import { AdminUser } from './auth.entities';
import { AbstractAuthUser } from './base.entities';

function StaticImplements<T>() {
  return (constructor: T) => {};
}

export class AdminUserIdentifierHelper implements IdentifierHelper<Partial<AdminUser>> {
  parse = (identifier: string): Partial<AdminUser> => ({ id: +identifier.slice(1) });

  stringify = (payload: Partial<AdminUser>): string => `admin=${payload.id}`;
}

@StaticImplements<IdentifierStatic>()
export class AdminUserIdentifier implements Identifier<AdminUser> {
  private readonly helper = new AdminUserIdentifierHelper();

  constructor(private readonly o: Partial<AdminUser>) {}

  identifier(): string {
    return this.helper.stringify(this.o);
  }

  identifierObject(): { type: string; id: number | string } {
    return { type: this.o.constructor.name, id: this.o.id };
  }

  payload(): Partial<AdminUser> {
    return this.o;
  }

  static resolve(identifier: string): { type: string; id: number | string } {
    return { type: identifier.split('=')[0], id: identifier.split('=')[1] };
  }

  static identify(identifier: string): boolean {
    return this.resolve(identifier).type === 'admin';
  }
}

@StaticImplements<IdentifierHelper<Partial<AbstractAuthUser>>>()
export class UserIdentifierHelper {
  static parse = (identifier: string): Partial<AbstractAuthUser> => ({ id: +identifier.split('=')[1] });

  static stringify = (payload: Partial<AbstractAuthUser>): string => `u=${payload.id}`;
}

@StaticImplements<IdentifierStatic>()
export class UserIdentifier implements Identifier<AbstractAuthUser> {
  private readonly helper = UserIdentifierHelper;

  constructor(private readonly o: Partial<AbstractAuthUser>) {}

  identifier(): string {
    return this.helper.stringify(this.o);
  }

  identifierObject(): { type: string; id: number | string } {
    return { type: this.o.constructor.name, id: this.o.id };
  }

  payload(): Partial<AbstractAuthUser> {
    return this.o;
  }

  static resolve(identifier: string): { type: string; id: number | string } {
    return { type: identifier.split('=')[0], id: identifier.split('=')[1] };
  }

  static identify(identifier: string): boolean {
    return this.resolve(identifier).type === 'u';
  }
}
