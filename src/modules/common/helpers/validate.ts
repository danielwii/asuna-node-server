import { ClassTransformOptions, deserialize, plainToClass } from 'class-transformer';
import {
  validate,
  validateSync,
  ValidationArguments,
  ValidationError,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';
import * as _ from 'lodash';
import { ClassType } from '../decorators';
import { AsunaErrorCode, AsunaException, ValidationException } from '../exceptions';
import { LoggerFactory } from '../logger/factory';
import { r } from './utils';

const logger = LoggerFactory.getLogger('Validator');

@ValidatorConstraint({ name: 'exclusiveConstraint', async: false })
export class ExclusiveConstraintValidator implements ValidatorConstraintInterface {
  defaultMessage = (validationArguments?: ValidationArguments): string =>
    `Exclusive constraint occurred: ${r(validationArguments, { stringify: true })}.`;

  validate = (value: any, validationArguments?: ValidationArguments): Promise<boolean> | boolean =>
    _.keys(_.omitBy(validationArguments.object, _.isNil)).length <= 1;
}

export async function validateObject(object): Promise<ValidationError[]> {
  if (!object) {
    return;
  }
  const errors = await validate(object);
  if (errors.length > 0) {
    logger.warn(`async validate ${r(object)} error: ${r(errors)}`);
    throw new ValidationException(errors.map((error) => error.property).join(','), errors);
  }
}

export function validateObjectSync(object): ValidationError[] {
  if (!object) {
    return;
  }
  const errors = validateSync(object);
  if (errors.length > 0) {
    logger.warn(`sync validate ${r(object)} error: ${r(errors)}`);
    throw new AsunaException(AsunaErrorCode.Unprocessable, `invalid object ${r(object, { stringify: true })}`, errors);
  }
}

export function deserializeSafely<T>(
  cls: ClassType<T>,
  json: string | JSON | T,
  options: ClassTransformOptions = { enableCircularCheck: true },
): T {
  if (!json) {
    return undefined;
  }

  if (json instanceof cls) {
    validateObjectSync(json);
    return json as T;
  }

  let o;
  if (_.isPlainObject(json)) {
    o = plainToClass(cls, json as JSON, options);
  } else if (_.isString(json)) {
    o = deserialize(cls, json as string, options);
  }

  logger.verbose(`deserializeSafely: ${r({ cls, o, json, options })}`);
  validateObjectSync(o);
  return o;
}
