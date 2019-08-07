import { ClassTransformOptions, deserialize, plainToClass } from 'class-transformer';
import { ClassType } from 'class-transformer/ClassTransformer';
import { validate, validateSync } from 'class-validator';
import * as _ from 'lodash';
import { AsunaError, AsunaException, ValidationException } from '../exceptions';
import { LoggerFactory } from '../logger';
import { r } from './utils';

const logger = LoggerFactory.getLogger('Validator');

export async function validateObject(object) {
  if (!object) {
    return;
  }
  const errors = await validate(object);
  if (errors.length) {
    logger.warn(`async validate ${r(object)} error: ${r(errors)}`);
    throw new ValidationException(errors.map(error => error.property).join(','), errors);
  }
}

export function validateObjectSync(object) {
  if (!object) {
    return;
  }
  const errors = validateSync(object);
  if (errors.length) {
    logger.warn(`sync validate ${r(object)} error: ${r(errors)}`);
    throw new AsunaException(
      AsunaError.Unprocessable,
      `invalid object ${r(object, { plain: true })}`,
      errors,
    );
  }
}

export function deserializeSafely<T>(
  cls: ClassType<T>,
  json: string | JSON | T,
  options: ClassTransformOptions = { enableCircularCheck: true },
): T {
  if (typeof cls === typeof json) {
    validateObjectSync(json);
    return json as T;
  }
  const o = _.isPlainObject(json)
    ? plainToClass(cls, json as JSON, options)
    : deserialize(cls, json as string, options);

  logger.debug(`deserializeSafely: ${r({ cls, o, json, options })}`);
  validateObjectSync(o);
  return o;
}
