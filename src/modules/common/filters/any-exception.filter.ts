import { ArgumentsHost, ExceptionFilter, HttpStatus, Logger } from '@nestjs/common';
import { HttpException } from '@nestjs/common/exceptions/http.exception';
import { FastifyReply } from 'fastify';
import * as _ from 'lodash';
import * as R from 'ramda';
import { getRepository, QueryFailedError } from 'typeorm';
import { EntityNotFoundError } from 'typeorm/error/EntityNotFoundError';
import { AsunaError, AsunaException, r, ValidationException } from '..';

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
    const reply = ctx.getResponse<FastifyReply<any>>();

    let processed = exception;

    if (R.is(QueryFailedError, exception)) {
      processed = AnyExceptionFilter.handleSqlExceptions(exception);
    } else if (R.is(EntityNotFoundError, exception)) {
      (<any>processed).status = HttpStatus.NOT_FOUND;
    } else if (processed.code) {
      if (processed.code === 'ERR_ASSERTION') {
        // TODO wrap with AsunaException
        (<any>processed).status = HttpStatus.BAD_REQUEST;
      }
      // logger.warn(`[unhandled exception] ${JSON.stringify(exception)}`);
    }

    const status: number = (<any>processed).status || HttpStatus.INTERNAL_SERVER_ERROR;
    const exceptionResponse = (<any>processed).response;

    if (status && status === HttpStatus.BAD_REQUEST) {
      logger.warn(`[bad_request] ${r(processed)}`);
    } else if (status && status === HttpStatus.NOT_FOUND) {
      logger.warn(`[not_found] ${r(processed.message)}`);
    } else if (/40\d/.test(`${status}`)) {
      logger.warn(`[unauthorized] ${r(processed)}`);
    } else {
      logger.error(`[unhandled exception] ${r(processed)}`);
    }

    if (!reply.sent && reply.status) {
      if (R.is(HttpException, processed)) {
        const key = _.isString(exceptionResponse.message) ? 'message' : 'errors';
        reply.status(status).send({
          error: {
            status,
            name: exceptionResponse.error,
            code: exceptionResponse.code,
            [key]: exceptionResponse.message,
            // raw: processed,
          } as AsunaException,
        });
      } else if (R.is(Error, processed)) {
        reply.status(status).send({
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
          reply.status(status).send({ error: processed as AsunaException });
        } catch (e) {
          reply
            .status(HttpStatus.INTERNAL_SERVER_ERROR)
            .send({ error: processed as AsunaException });
        }
      }
    }
  }
}
