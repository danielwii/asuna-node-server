import { ArgumentsHost, Catch, ExceptionFilter, HttpStatus, Logger } from '@nestjs/common';
import { HttpException } from '@nestjs/common/exceptions/http.exception';
import * as R from 'ramda';
import { getRepository, QueryFailedError } from 'typeorm';
import { EntityNotFoundError } from 'typeorm/error/EntityNotFoundError';

import { ValidationException } from '../../base/base.exceptions';

@Catch()
export class AnyExceptionFilter implements ExceptionFilter {
  private static readonly logger = new Logger(AnyExceptionFilter.name);

  static handleSqlExceptions(exception) {
    if (R.is(QueryFailedError, exception)) {
      /*
       * 包装唯一性约束，用于前端检测
       */
      if (exception.code === 'ER_DUP_ENTRY') {
        const [, value, key] = exception.sqlMessage.match(/Duplicate entry '(.+)' for key '(.+)'/);
        const [, model] = exception.sql.match(/`(\w+)`.+/);
        const metadata = getRepository(model).metadata;
        const [index] = metadata.indices.filter(index => index.name === key);
        return new ValidationException(
          index.name,
          (index.givenColumnNames as string[]).map(name => ({
            constraints: {
              isUnique: `${name} must be unique`,
            },
            property: name,
            target: { [name]: value },
            value,
          })),
        );
      } else {
        console.warn('[unhandled QueryFailedError]', exception);
      }
    } else if (R.is(EntityNotFoundError, exception)) {
      exception.status = 404;
    } else {
      console.warn('[unhandled exception]', { exception });
    }
    return exception;
  }

  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();
    const request = ctx.getRequest();

    const e = AnyExceptionFilter.handleSqlExceptions(exception);

    if (e.status && e.status === HttpStatus.BAD_REQUEST) {
      AnyExceptionFilter.logger.warn(JSON.stringify(e.message));
      console.warn(e);
    } else if (e.status && e.status === HttpStatus.NOT_FOUND) {
      AnyExceptionFilter.logger.warn(JSON.stringify(e.message));
    } else {
      AnyExceptionFilter.logger.error(JSON.stringify(e.message));
      console.error(e);
    }

    const status = e.status || HttpStatus.INTERNAL_SERVER_ERROR;

    if (R.is(HttpException, e)) {
      response.status(status).json({
        name: e.response.error,
        message: e.response.message,
      });
    } else if (R.is(Error, e)) {
      response.status(status).json({
        name: 'Error',
        message: e.message,
      });
    } else {
      response.status(status).json(e);
    }
  }
}
