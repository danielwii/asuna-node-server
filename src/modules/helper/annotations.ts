export const ASUNA_METADATA_KEYS = {
  NAMED: 'asuna:named',
};

export const named: MethodDecorator = function (target, propertyKey, descriptor) {
  const originalMethod = descriptor.value;
  // @ts-ignore
  descriptor.value = function (...args: any[]) {
    // @ts-ignore
    return Reflect.apply(originalMethod, this, [...args, propertyKey]);
  };

  Reflect.defineMetadata(ASUNA_METADATA_KEYS.NAMED, String(propertyKey), descriptor.value);
  return descriptor;
};
