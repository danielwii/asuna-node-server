import { SimpleIdGenerator } from '../ids';
import { AsunaErrorCode, AsunaException, LoggerFactory } from '../common';
import * as _ from 'lodash';

const logger = LoggerFactory.getLogger('JwtAdminAuthGuard');

export class IdGenerators {
  static handlers: Record<string, SimpleIdGenerator> = {};
  static handlersByEntity: Record<string, SimpleIdGenerator> = {};

  static exists(prefix: string, entity: string) {
    const prefixExists = _.keys(this.handlers).includes(prefix);
    const entityExists = _.keys(this.handlersByEntity).includes(entity);
    if (prefixExists && entityExists) {
      return true;
    } else if (!prefixExists && !entityExists) {
      return false;
    } else {
      logger.error(`${prefix} or ${entity} already exists in id generators.`);
      // throw new AsunaException(AsunaErrorCode.Unprocessable, `${prefix} or ${entity} already exists in id generators.`);
      return false;
    }
  }

  static reg(prefix: string, entity: string): void {
    // this.exists(prefix, entity);
    this.handlers[prefix] = new SimpleIdGenerator(prefix);
    this.handlersByEntity[entity] = this.handlers[prefix];
  }

  static nextId(prefix: string): string {
    if (!_.keys(this.handlers).includes(prefix)) {
      throw new AsunaException(AsunaErrorCode.Unprocessable, `prefix ${prefix} not found in id generators.`);
    }
    return this.handlers[prefix].nextId();
  }

  static nextIdByEntity(entity: string): string {
    if (!_.keys(this.handlersByEntity).includes(entity)) {
      throw new AsunaException(AsunaErrorCode.Unprocessable, `entity ${entity} not found in id generators.`);
    }
    return this.handlersByEntity[entity].nextId();
  }
}
