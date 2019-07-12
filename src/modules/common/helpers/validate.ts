import { validate, validateSync } from 'class-validator';
import { AsunaError, AsunaException, r, ValidationException } from '..';

export async function validateObject(object) {
  const errors = await validate(object);
  if (errors.length) {
    throw new ValidationException(errors.map(error => error.property).join(','), errors);
  }
}

export function validateObject2(object) {
  const errors = validateSync(object);
  if (errors.length) {
    throw new AsunaException(AsunaError.Unprocessable, `invalid settings ${r(errors)}`);
  }
}

export function assert(condition, message) {
  if (!condition) {
    throw new AsunaException(AsunaError.InvalidParameter, message);
  }
}
