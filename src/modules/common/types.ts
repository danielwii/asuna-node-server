/* class decorator */
export function StaticImplements<T>() {
  return (constructor: T) => {};
}
