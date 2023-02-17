import * as Sentry from '@sentry/node';

import { ArgumentsHost, ExceptionFilter, HttpStatus, Logger } from '@nestjs/common';
import { HttpException } from '@nestjs/common/exceptions/http.exception';

import { AsunaErrorCode, AsunaException, ValidationException } from '@danielwii/asuna-helper/dist/exceptions';
import { r } from '@danielwii/asuna-helper/dist/serializer';
import { ApiResponse } from '@danielwii/asuna-shared/dist/vo';

import _ from 'lodash';
import * as R from 'ramda';
import { QueryFailedError } from 'typeorm';
import { EntityNotFoundError } from 'typeorm/error/EntityNotFoundError';

import { AppDataSource } from '../../datasource';
import { StatsHelper } from '../../stats';

import type { Response } from 'express';

type QueryFailedErrorType = QueryFailedError &
  Partial<{
    message: string;
    code: string;
    errno: number;
    sqlMessage: string;
    sqlState: string;
    index: number;
    sql: string;
    name: string;
    query: string;
    parameters: string[];
  }>;

export class AnyExceptionFilter implements ExceptionFilter {
  static handleSqlExceptions(exception: QueryFailedErrorType): ValidationException | QueryFailedErrorType {
    // 包装唯一性约束，用于前端检测
    if (exception.code === 'ER_DUP_ENTRY') {
      const [, value, key] = exception.sqlMessage.match(/Duplicate entry '(.*)' for key '(.+)'/);
      const [, model] = exception.sql.match(/`(\w+)`.+/);
      const { metadata } = AppDataSource.dataSource.getRepository(model);
      if (!metadata) {
        Logger.error(`unhandled ER_DUP_ENTRY error: ${r(exception)}`);
        return new AsunaException(AsunaErrorCode.Unprocessable, 'dup entry error');
      }
      const [index] = metadata.indices.filter((i) => i.name === key);
      if (index)
        return new ValidationException(
          index.name,
          (index.givenColumnNames as string[]).map((name) => ({
            constraints: { isUnique: `${name} must be unique` },
            property: name,
            target: { [name]: value },
            value,
          })),
        );
      return new AsunaException(AsunaErrorCode.Duplicate, `${value} already exists.`);
    }

    // 未找到默认值
    if (exception.code === 'ER_NO_DEFAULT_FOR_FIELD') {
      const [, name] = exception.sqlMessage.match(/Field '(.*)' doesn't have a default value/);
      const value = undefined;
      return new ValidationException('ER_NO_DEFAULT_FOR_FIELD', [
        {
          constraints: { notNull: `${name} must not be empty` },
          property: name,
          target: { [name]: value },
          value,
        },
      ]);
    }

    if (exception.code === 'ER_PARSE_ERROR') {
      return new AsunaException(AsunaErrorCode.Unprocessable, 'parse error');
    }
    if (exception.code === 'PROTOCOL_CONNECTION_LOST') {
      (async () => {
        await AppDataSource.dataSource.destroy();
        await AppDataSource.dataSource.initialize();
      })();
      return new AsunaException(AsunaErrorCode.Unprocessable, 'connection lost, reconnect...');
    }

    Logger.error(`unresolved QueryFailedError: ${r(exception)}`);
    return exception;
  }

  // eslint-disable-next-line complexity
  catch(exception: any, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();

    let processed = _.omit(exception, 'options');

    if (R.is(QueryFailedError, exception)) {
      processed = AnyExceptionFilter.handleSqlExceptions(exception);
      // } else if (R.is(EntityColumnNotFound, exception)) {
      //   processed.status = HttpStatus.UNPROCESSABLE_ENTITY;
    } else if (R.is(EntityNotFoundError, exception)) {
      processed.status = HttpStatus.NOT_FOUND;
    } else if (exception.name === 'ArgumentError') {
      processed.status = HttpStatus.UNPROCESSABLE_ENTITY;
      Logger.warn(`[ArgumentError] found ${r(processed)}, need to convert to 400 error body`);
    } else if (processed.code) {
      if (processed.code === 'ERR_ASSERTION') {
        // TODO wrap with AsunaException
        processed.status = HttpStatus.BAD_REQUEST;
      }
    }

    const httpStatus: number = processed.status || processed.httpStatus || HttpStatus.INTERNAL_SERVER_ERROR;
    const exceptionResponse = processed.response;

    // Logger.log(`check status ${r({ httpStatus, processed })}`);

    if (httpStatus && httpStatus === HttpStatus.BAD_REQUEST) {
      // Logger.warn(`[bad_request] ${r(processed)}`);
      Logger.warn(`[bad_request] ${r(processed.message)}`);
    } else if (httpStatus && httpStatus === HttpStatus.NOT_FOUND) {
      Logger.warn(`[not_found] ${r(processed.message)}`);
    } else if (/40[13]/.test(`${httpStatus}`)) {
      // Logger.warn(`[unauthorized] ${r(processed)}`);
    } else if (/4\d+/.test(`${httpStatus}`)) {
      Logger.warn(`[client_error] ${r(processed)}`);
    } else {
      Logger.error(`[unhandled exception] ${r(processed)}`);
      Sentry.captureException(processed);
    }

    if (res.writableEnded) return;

    let body: { error: Partial<AsunaException> };
    let message: string;

    if (R.is(HttpException, processed)) {
      const key = _.isString(exceptionResponse.message) ? 'message' : 'errors';
      message = exceptionResponse.message;
      const error: Partial<AsunaException> = {
        // httpStatus,
        message: exceptionResponse.error,
        code: exceptionResponse.code,
        [key]: message,
        // raw: processed,
      };
      body = { error };
    } else if (R.is(Error, processed) && !R.is(AsunaException, processed)) {
      message = processed.message;
      const error: Partial<AsunaException> = {
        // httpStatus,
        message: processed.name || AsunaErrorCode.Unexpected__do_not_use_it.name,
        code: `${(processed as any).code || AsunaErrorCode.Unexpected__do_not_use_it.value}`,
        // message,
        // raw: processed,
      };
      body = { error };
    } else {
      message = processed.message;
      body = {
        error: {
          // ...(processed as AsunaException),
          message: processed.name,
          // code: processed.code || processed.status || AsunaErrorCode.Unexpected__do_not_use_it.value,
        },
      };
    }

    if (_.isNil(body.error.code)) {
      Logger.warn(`no code found for one error: ${r(message)}`);
    }

    const isGraphqlRes = !res.status;
    const errorInfo = {
      httpStatus,
      isGraphqlRes,
      message,
      body: _.omit(body, 'error.message'),
      type: typeof exception,
      name: exception.constructor.name,
      isHttpException: exception instanceof HttpException,
      isError: exception instanceof Error,
      isAsunaException: exception instanceof AsunaException,
    };
    if (![404].includes(httpStatus)) {
      if ([401, 403].includes(httpStatus)) {
        Logger.warn(`[unauthorized]: ${r(errorInfo)}`);
      } else {
        Logger.error(`[ERROR]: ${r(errorInfo)}`);
        StatsHelper.addErrorInfo(String(httpStatus), errorInfo).catch(console.error);
      }
    }
    /*
    if (exception instanceof Error && httpStatus !== 500) {
      Logger.error(exception);
    }
*/

    // res.status 不存在时可能是 graphql 的请求，不予处理，直接抛出异常r
    if (isGraphqlRes) {
      throw new Error(JSON.stringify(body));
    }

    // Logger.error(`send ${r(body)} status: ${httpStatus}`);
    const response = ApiResponse.failure({
      status: body.error.httpStatus,
      // code: body.error.code,
      error: body.error,
      message, // : body.error.message || body.error.name,
    });
    res.status(httpStatus).send(response);
  }
}
