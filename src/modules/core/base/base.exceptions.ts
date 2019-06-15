import { HttpStatus } from '@nestjs/common';

export class BaseException {
  constructor(public name: string, public message?: string, public errors?: any) {}
}

export class CodeException extends BaseException {
  constructor(
    public code: string,
    public name: string,
    public message?: string,
    public errors?: any,
  ) {
    super(name, message, errors);
  }
}

export enum AsunaCode {
  /**
   * 对象格式验证异常
   */
  VALIDATE = 'VALIDATE',
  UPLOAD = 'UPLOAD',
  SIGN = 'SIGN',
  BAD_REQUEST = 'BAD_REQUEST',
  UNPROCESSABLE_ENTITY = 'UNPROCESSABLE_ENTITY',
  INTERNAL = 'INTERNAL',
}

/**
 * 该异常构造前端可以进行交互的格式
 */
export class AsunaException extends CodeException {
  status = 500;

  constructor(code: AsunaCode | string, message: string, errors?: any) {
    super('ASUNA__' + code, code, message, errors);
    if (AsunaCode.BAD_REQUEST === code) {
      this.status = HttpStatus.BAD_REQUEST;
    } else if (AsunaCode.UNPROCESSABLE_ENTITY === code) {
      this.status = HttpStatus.UNPROCESSABLE_ENTITY;
    }
  }
}

export class ErrorException extends BaseException {}

export class ValidationException extends AsunaException {
  constructor(model, errors) {
    super(AsunaCode.VALIDATE, `validate '${model}' error`, errors);
    this.status = HttpStatus.BAD_REQUEST;
  }
}
export class UploadException extends AsunaException {
  constructor(errors) {
    super(AsunaCode.UPLOAD, `upload file(s) error`, errors);
  }
}

export class SignException extends AsunaException {
  constructor(message) {
    super(AsunaCode.SIGN, message);
  }
}
