export function named(target: object, propertyKey: string, descriptor: TypedPropertyDescriptor<any>) {
  const originalMethod = descriptor.value;
  // eslint-disable-next-line no-param-reassign,func-names
  descriptor.value = function (...args: any[]) {
    return Reflect.apply(originalMethod, this, [...args, propertyKey]);
  };

  return descriptor;
}
