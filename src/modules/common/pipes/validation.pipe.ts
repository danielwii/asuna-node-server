import { ArgumentMetadata, Injectable, PipeTransform } from '@nestjs/common';
import { plainToClass } from 'class-transformer';
import { LoggerFactory, r, validateObjectSync, ValidationException } from '..';

const logger = LoggerFactory.getLogger('CustomValidationPipe');

/**
 * app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true })) is used already.
 */
@Injectable()
export class CustomValidationPipe implements PipeTransform<any> {
  transform(value: any, { metatype }: ArgumentMetadata) {
    logger.debug(`transform ${r({ value, metatype })}`);
    if (value) {
      if (!metatype || !this.toValidate(metatype)) {
        logger.debug(`return value directly ${r(this.toValidate(metatype))}`);
        return value;
      }
      const object = plainToClass(metatype, value, { enableImplicitConversion: true });
      const errors = validateObjectSync(object);
      logger.debug(`transformed ${r({ object, errors })}`);
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
