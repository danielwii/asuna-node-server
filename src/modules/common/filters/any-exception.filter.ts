import { ArgumentsHost, ExceptionFilter, HttpStatus, Logger } from '@nestjs/common';
import { HttpException } from '@nestjs/common/exceptions/http.exception';
import { Request, Response } from 'express';
import * as _ from 'lodash';
import * as R from 'ramda';
import { getRepository, QueryFailedError } from 'typeorm';
import { EntityNotFoundError } from 'typeorm/error/EntityNotFoundError';
import { AsunaError, AsunaException, ValidationException } from '../../core';
import { renderObject } from '../../logger';

const logger = new Logger('AnyExceptionFilter');

export class AnyExceptionFilter implements ExceptionFilter {
  static handleSqlExceptions(exception) {
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
    }
    return exception;
  }

  catch(exception: any, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let processed = exception;

    if (R.is(QueryFailedError, exception)) {
      processed = AnyExceptionFilter.handleSqlExceptions(exception);
    } else if (R.is(EntityNotFoundError, exception)) {
      (<any>processed).status = 404;
    } else {
      // logger.warn(`[unhandled exception] ${JSON.stringify(exception)}`);
    }

    const status: number = (<any>processed).status || HttpStatus.INTERNAL_SERVER_ERROR;
    const exceptionResponse = (<any>processed).response;

    if (status && status === HttpStatus.BAD_REQUEST) {
      logger.warn(`[bad_request] ${renderObject(processed.message)}`);
    } else if (status && status === HttpStatus.NOT_FOUND) {
      logger.warn(`[not_found] ${renderObject(processed.message)}`);
    } else if (/40\d/.test(`${status}`)) {
      logger.warn(`[unauthorized] ${renderObject(processed.message)}`);
    } else {
      logger.error(`[unhandled exception] ${renderObject(processed.message)}`, processed.stack);
    }

    if (!response.finished && response.status) {
      if (R.is(HttpException, processed)) {
        const key = _.isString(exceptionResponse.message) ? 'message' : 'errors';
        response.status(status).json({
          error: {
            status,
            name: exceptionResponse.error,
            code: exceptionResponse.code,
            [key]: exceptionResponse.message,
            // raw: processed,
          } as AsunaException,
        });
      } else if (R.is(Error, processed)) {
        response.status(status).json({
          error: {
            status,
            name: AsunaError.Unexpected__do_not_use_it.name,
            code: processed.status || AsunaError.Unexpected__do_not_use_it.value,
            message: processed.message,
            // raw: processed,
          } as AsunaException,
        });
      } else {
        try {
          response.status(status).json({ error: processed as AsunaException });
        } catch (e) {
          response
            .status(HttpStatus.INTERNAL_SERVER_ERROR)
            .json({ error: processed as AsunaException });
        }
      }
    }
  }
}
