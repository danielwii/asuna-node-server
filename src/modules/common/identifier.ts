export type PrimaryKey = number | string;

export interface IdentifierHelper<T = object> {
  stringify: (payload: T) => string;
  parse: (identifier: string) => T;
}

export interface IdentifierStatic {
  resolve: (identifier: string) => { type: string; id: number | string };

  identify: (identifier: string) => boolean;
}

export interface Identifier<T = any> {
  payload: () => Partial<T>;

  identifier: () => string;

  identifierObject: () => { type: string; id: number | string };
}
