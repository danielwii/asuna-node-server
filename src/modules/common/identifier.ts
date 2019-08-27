export interface IdentifierHelper<T = object> {
  stringify: (payload: T) => string;
  parse: (identifier: string) => T;
}

export interface Identifier<T = any> {
  payload(): Partial<T>;

  identifier(): string;

  identifierObject(): { type: string; id: number | string };
}
