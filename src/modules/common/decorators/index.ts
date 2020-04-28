export * from './meta.decorator';
export * from './user.decorator';

export declare type ClassType<T> = {
  new (...args: any[]): T;
};
