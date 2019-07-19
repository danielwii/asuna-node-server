import { validate, validateSync } from 'class-validator';
import { AsunaError, AsunaException, r, ValidationException } from '..';
import { LoggerFactory } from '../../logger';

const logger = LoggerFactory.getLogger('Validator');

export async function validateObject(object) {
  if (!object) {
    return;
  }
  const errors = await validate(object);
  if (errors.length) {
    throw new ValidationException(errors.map(error => error.property).join(','), errors);
  }
}

export function validateObjectSync(object) {
  if (!object) {
    return;
  }
  const errors = validateSync(object);
  if (errors.length) {
    logger.warn(r(errors));
    throw new AsunaException(
      AsunaError.Unprocessable,
      `invalid object ${r(object, { plain: true })}`,
      errors,
    );
  }
}
