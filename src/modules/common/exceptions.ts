// tslint:disable:max-line-length
import { HttpStatus } from '@nestjs/common';
import { NameValue } from './helpers';

/**
 * 400  invalidParameter          Indicates that a request parameter has an invalid value.
 * 400  badRequest
 * 401  invalidCredentials        Indicates that the auth token is invalid or has expired.
 * 403  insufficientPermissions   Indicates that the user does not have sufficient permissions for the entity specified in the query.
 * 409  conflict                  Indicates that the request message conflicts with the current state of the resource.
 *                                The API request cannot be completed because the requested operation would conflict with an existing item. For example, a request that tries to create a duplicate item would create a conflict, though duplicate items are typically identified with more specific errors.
 * 409  duplicate                 The requested operation failed because it tried to create a resource that already exists.
 * 422  unprocessable             Indicates an issue with the request message considered in isolation.
 * 429  tooManyRequests
 * 500  unexpected                Better not use it.
 */
export const AsunaError = {
  InvalidParameter: new NameValue('Invalid Parameter', 400),
  BadRequest: new NameValue('Bad Request', 400),
  InvalidCredentials: new NameValue('Invalid Credentials', 401),
  InsufficientPermissions: new NameValue('Insufficient Permissions', 403),
  NotFound: new NameValue('Not Found', 404),
  Conflict: new NameValue('Conflict', 409),
  Duplicate: new NameValue('Duplicate', 409),
  TooManyRequests: new NameValue('Too Many Requests', 429),
  Unprocessable: new NameValue('Unprocessable', 422),

  /**
   * use specific errors instead
   */
  Unexpected__do_not_use_it: new NameValue('Unexpected', 500),
  // VALIDATE = 'VALIDATE',
  // UPLOAD = 'UPLOAD',
  // SIGN = 'SIGN',
  // BAD_REQUEST = 'BAD_REQUEST',
  // UNPROCESSABLE_ENTITY = 'UNPROCESSABLE_ENTITY',
};

/**
 * 该异常构造前端可以进行交互的格式
 */
export class AsunaBaseException extends Error {
  constructor(
    public status: HttpStatus,
    public code: string,
    public name: string,
    public message: string,
    public errors?: any,
  ) {
    super(message);
  }
}

export class AsunaException extends AsunaBaseException {
  constructor(nameValue: NameValue, message?: string, errors?: any) {
    super(nameValue.value, null, nameValue.name, message, errors);
  }
}

export class AsunaCodeException extends AsunaBaseException {
  constructor(nameValue: NameValue, code: string, message?: string, errors?: any) {
    super(nameValue.value, code, nameValue.name, message, errors);
  }
}

export class ErrorException extends AsunaBaseException {
  constructor(name: string, message?: string, errors?: any) {
    super(AsunaError.Unprocessable.value, name, AsunaError.Unprocessable.name, message, errors);
  }
}

export class ValidationException extends AsunaException {
  constructor(model, errors) {
    super(AsunaError.InvalidParameter, `validate '${model}' error`, errors);
  }
}

export class UploadException extends AsunaException {
  constructor(errors) {
    super(AsunaError.Unprocessable, 'upload file(s) error', errors);
  }
}

/**
 * @deprecated use AsunaException directly
 */
export class SignException extends AsunaException {
  constructor(message) {
    super(AsunaError.InvalidCredentials, message);
  }
}
