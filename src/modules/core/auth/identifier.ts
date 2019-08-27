import { Identifier, IdentifierHelper } from '../../common';
import { AdminUser } from './auth.entities';
import { AbstractAuthUser } from './base.entities';

export class AdminUserIdentifierHelper implements IdentifierHelper<Partial<AdminUser>> {
  parse = (identifier: string): Partial<AdminUser> => ({ id: +identifier.slice(1) });

  stringify = (payload: Partial<AdminUser>): string => `admin=${payload.id}`;
}

export class AdminUserIdentifier implements Identifier<AdminUser> {
  private readonly helper = new UserIdentifierHelper();

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
}

export class UserIdentifierHelper implements IdentifierHelper<Partial<AbstractAuthUser>> {
  parse = (identifier: string): Partial<AbstractAuthUser> => ({ id: +identifier.slice(1) });

  stringify = (payload: Partial<AbstractAuthUser>): string => `u=${payload.id}`;
}

export class UserIdentifier implements Identifier<AbstractAuthUser> {
  private readonly helper = new UserIdentifierHelper();

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
}
