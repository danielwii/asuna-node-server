import * as Sentry from '@sentry/node';

import { ArgumentsHost, ExceptionFilter, HttpStatus, Logger } from '@nestjs/common';
import { HttpException } from '@nestjs/common/exceptions/http.exception';

import {
  AsunaBaseException,
  AsunaErrorCode,
  AsunaException,
  ValidationException,
} from '@danielwii/asuna-helper/dist/exceptions';
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
    if (_.has(exception, 'hint')) {
      _.set(exception, 'details', [_.get(exception, 'hint')]);
      // _.set(exception, 'httpStatus', HttpStatus.INTERNAL_SERVER_ERROR);
      return exception;
    }

    Logger.error(`unresolved QueryFailedError: ${r(exception)}`);
    return exception;
  }

  // eslint-disable-next-line complexity
  catch(exception: any, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();

    // make all exception to common standard
    const processed: {
      httpStatus: string;
      code?: string;
      type?: string;
      message?: string;
      details?: any[];
      // cause: Error;
      parsed?: {
        // use it all the time
        status: number;
        message: string;
        error: {
          type: string;
          code?: string;
          details?: any[];
          cause?: Error;
        };
      };
    } = (() => {
      if (R.is(QueryFailedError, exception)) {
        Logger.warn(`[QueryFailedError] ${r(exception)}`);
        return AnyExceptionFilter.handleSqlExceptions(exception);
        // } else if (R.is(EntityColumnNotFound, exception)) {
        //   processed.status = HttpStatus.UNPROCESSABLE_ENTITY;
      } else if (R.is(EntityNotFoundError, exception)) {
        Logger.warn(`[EntityNotFoundError] ${r(exception)}`);
        return { ...exception, status: HttpStatus.NOT_FOUND };
      } else if (exception.name === 'ArgumentError') {
        Logger.warn(`[ArgumentError] ${r(exception)}`);
        return { ...exception, status: HttpStatus.UNPROCESSABLE_ENTITY };
      } else if (R.is(AsunaBaseException, exception)) {
        Logger.warn(`[AsunaBaseException] ${r(exception)}`);
        return exception;
      } else if (R.is(HttpException, exception)) {
        Logger.warn(`[HttpException] ${r(exception)}`);
        const details = _.get(exception, 'response.message');
        return {
          parsed: {
            status: exception.getStatus(),
            message: _.isString(details) ? details : _.get(exception, 'response.error') ?? exception.message,
            error: {
              type: exception.constructor.name,
              details: _.isArray(details) ? details : undefined,
              cause: _.get(exception, 'cause.message'),
            },
          },
        };
      } else if (R.is(Error, exception)) {
        Logger.warn(`[Error] ${r(exception)}`);
        return {
          parsed: {
            status: HttpStatus.UNPROCESSABLE_ENTITY,
            message: exception.message,
            error: { type: exception.constructor.name },
          },
        };
      } else if (exception.code) {
        Logger.warn(`[Others] ${r(exception)}`);
        if (exception.code === 'ERR_ASSERTION') {
          // processed.status = HttpStatus.BAD_REQUEST;
          return new AsunaException(AsunaErrorCode.BadRequest, exception.message, exception);
        }
      }
    })();

    // Logger.warn(`[exception] ${r({ exception, processed })}`);

    const httpStatus: number =
      exception.status || processed.httpStatus || processed.parsed?.status || HttpStatus.INTERNAL_SERVER_ERROR;
    // const exceptionResponse = processed.response;
    processed.message = exception.message;

    Logger.warn(`processed ${r({ httpStatus, processed })}`);

    if (httpStatus === HttpStatus.BAD_REQUEST) {
      // Logger.warn(`[bad_request] ${r(processed)}`);
      Logger.warn(`[bad_request] ${r(processed.message)}`);
    } else if (httpStatus === HttpStatus.NOT_FOUND) {
      Logger.warn(`[not_found] ${r(processed.message)}`);
    } else if (/40[13]|422/.test(`${httpStatus}`)) {
      // Logger.warn(`[unauthorized] ${r(processed)}`);
    } else if (/4\d+/.test(`${httpStatus}`)) {
      Logger.warn(`[client_error] ${r(processed)}`);
    } else {
      Logger.error(`[unhandled exception] ${r(processed)}`);
      Sentry.captureException(processed);
    }

    if (res.writableEnded) return;

    /*
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
          code:
            _.get(processed, 'errors.code') ||
            processed.code ||
            processed.status ||
            AsunaErrorCode.Unexpected__do_not_use_it.value,
        },
      };
    }

    if (_.isNil(body.error.code)) {
      Logger.warn(`no code found for one error: ${r(message)}`);
    }
*/

    const isGraphqlRes = !res.status;
    const errorInfo = {
      // httpStatus,
      isGraphqlRes,
      // message,
      // body,
      // type: typeof exception,
      httpStatus,
      exceptionStatus: exception.status,
      processedHttpStatus: processed.httpStatus,
      processed: processed.constructor.name,
      exception: exception.constructor.name,
      isHttpException: exception instanceof HttpException,
      isError: exception instanceof Error,
      isAsunaException: exception instanceof AsunaException,
      isAsunaBaseException: exception instanceof AsunaBaseException,
    };
    if (![404].includes(httpStatus)) {
      if ([401, 403].includes(httpStatus)) {
        Logger.warn(`[unauthorized]: ${r(errorInfo)}`);
      } else {
        Logger.error(`[ErrorInfo]: ${r(errorInfo)}`);
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
      throw new Error(JSON.stringify(exception));
      // throw new Error(JSON.stringify(body));
    }

    if (processed.parsed) {
      res.status(processed.parsed.status).send(processed.parsed);
    } else {
      // Logger.error(`send ${r({ body, message, processed, errorInfo })} status: ${httpStatus}`);
      const details = processed.details ?? exception.details;
      const response = ApiResponse.failure({
        status: httpStatus,
        message: exception.message,
        error: {
          code: exception.code || undefined,
          type: exception.constructor.name || exception.name,
          details: details === exception.message ? undefined : details,
        },
      });
      res.status(httpStatus).send(response);
    }
  }
}
