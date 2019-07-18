import { validate, validateSync } from 'class-validator';
import { AsunaError, AsunaException, r, ValidationException } from '..';

export async function validateObject(object) {
  const errors = await validate(object);
  if (errors.length) {
    throw new ValidationException(errors.map(error => error.property).join(','), errors);
  }
}

export function validateObjectSync(object) {
  const errors = validateSync(object);
  if (errors.length) {
    throw new AsunaException(AsunaError.Unprocessable, `invalid settings ${r(errors)}`);
  }
}
