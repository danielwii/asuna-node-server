import { ArgumentMetadata, Injectable, PipeTransform } from '@nestjs/common';
import { plainToClass } from 'class-transformer';
import { validate } from 'class-validator';
import { ValidationException } from '..';

/**
 * app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true })) is used already.
 */
@Injectable()
export class CustomValidationPipe implements PipeTransform<any> {
  async transform(value: any, { metatype }: ArgumentMetadata) {
    if (value) {
      if (!metatype || !this.toValidate(metatype)) {
        return value;
      }
      const object = plainToClass(metatype, value);
      const errors = await validate(object);
      if (errors.length > 0) {
        throw new ValidationException(metatype.name, errors);
      }
    }
    return value;
  }

  private toValidate(metatype: Function): boolean {
    const types: Function[] = [String, Boolean, Number, Array, Object];
    return !types.includes(metatype);
  }
}
