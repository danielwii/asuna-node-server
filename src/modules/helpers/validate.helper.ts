import { validate } from 'class-validator';

import { ValidationException } from '../base';

export const validateObject = async object => {
  const errors = await validate(object);
  if (errors.length) {
    throw new ValidationException(errors.map(error => error.property).join(','), errors);
  }
};
