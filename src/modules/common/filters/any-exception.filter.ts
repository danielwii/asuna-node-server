import { ArgumentsHost, ExceptionFilter, HttpStatus } from '@nestjs/common';
import { HttpException } from '@nestjs/common/exceptions/http.exception';
import { Response } from 'express';
import * as _ from 'lodash';
import * as R from 'ramda';
import { getRepository, QueryFailedError } from 'typeorm';
import { EntityNotFoundError } from 'typeorm/error/EntityNotFoundError';
import { AsunaErrorCode, AsunaException, ValidationException } from '../exceptions';
import { r } from '../helpers';
import { LoggerFactory } from '../logger';

const logger = LoggerFactory.getLogger('AnyExceptionFilter');

export class AnyExceptionFilter implements ExceptionFilter {
  static handleSqlExceptions(exception): any {
    /*
     * 包装唯一性约束，用于前端检测
     */
    if (exception.code === 'ER_DUP_ENTRY') {
      const [, value, key] = exception.sqlMessage.match(/Duplicate entry '(.+)' for key '(.+)'/);
      const [, model] = exception.sql.match(/`(\w+)`.+/);
      const { metadata } = getRepository(model);
      const [index] = metadata.indices.filter(i => i.name === key);
      return new ValidationException(
        index.name,
        (index.givenColumnNames as string[]).map(name => ({
          constraints: { isUnique: `${name} must be unique` },
          property: name,
          target: { [name]: value },
          value,
        })),
      );
    }
    return exception;
  }

  catch(exception: any, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();

    let processed = exception;

    if (R.is(QueryFailedError, exception)) {
      processed = AnyExceptionFilter.handleSqlExceptions(exception);
    } else if (R.is(EntityNotFoundError, exception)) {
      processed.status = HttpStatus.NOT_FOUND;
    } else if (processed.code) {
      if (processed.code === 'ERR_ASSERTION') {
        // TODO wrap with AsunaException
        processed.status = HttpStatus.BAD_REQUEST;
      }
    }

    const httpStatus: number = processed.status || HttpStatus.INTERNAL_SERVER_ERROR;
    const exceptionResponse = processed.response;

    if (httpStatus && httpStatus === HttpStatus.BAD_REQUEST) {
      // logger.warn(`[bad_request] ${r(processed)}`);
      logger.warn(`[bad_request] ${r(processed.message)}`);
    } else if (httpStatus && httpStatus === HttpStatus.NOT_FOUND) {
      logger.warn(`[not_found] ${r(processed.message)}`);
    } else if (/40[13]/.test(`${httpStatus}`)) {
      logger.warn(`[unauthorized] ${r(processed)}`);
    } else if (/4\d+/.test(`${httpStatus}`)) {
      logger.warn(`[client_error] ${r(processed)}`);
    } else {
      logger.error(`[unhandled exception] ${r(processed)}`);
    }

    if (res.finished) return;

    let body;
    let message;

    if (R.is(HttpException, processed)) {
      const key = _.isString(exceptionResponse.message) ? 'message' : 'errors';
      message = exceptionResponse.message;
      body = {
        error: {
          httpStatus,
          name: exceptionResponse.error,
          code: exceptionResponse.code,
          [key]: message,
          // raw: processed,
        } as AsunaException,
      };
    } else if (R.is(Error, processed) && !R.is(AsunaException, processed)) {
      message = processed.message;
      body = {
        error: {
          httpStatus,
          name: AsunaErrorCode.Unexpected__do_not_use_it.name,
          code: processed.status || AsunaErrorCode.Unexpected__do_not_use_it.value,
          message,
          // raw: processed,
        } as AsunaException,
      };
    } else {
      message = processed.message;
      body = {
        error: {
          ...(processed as AsunaException),
          message,
          // code: processed.code || processed.status || AsunaErrorCode.Unexpected__do_not_use_it.value,
        },
      };
    }

    logger.error({
      message,
      body: _.omit(body, 'error.message'),
      type: typeof exception,
      isHttpException: exception instanceof HttpException,
      isError: exception instanceof Error,
      isAsunaException: exception instanceof AsunaException,
    });

    // res.status 不存在时可能是 graphql 的请求，不予处理，直接抛出异常r
    if (!res.status) {
      throw new Error(JSON.stringify(body));
    }

    res.status(httpStatus).send(body);
  }
}
