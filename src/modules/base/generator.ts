import { Logger } from '@nestjs/common';

import { AsunaErrorCode, AsunaException } from '@danielwii/asuna-helper/dist/exceptions';

import _ from 'lodash';

import { SimpleIdGenerator } from '../ids';

export class IdGenerators {
  public static handlers: Record<string, SimpleIdGenerator> = {};
  public static handlersByEntity: Record<string, SimpleIdGenerator> = {};

  public static exists(prefix: string, entity: string): boolean {
    const prefixExists = _.keys(this.handlers).includes(prefix);
    const entityExists = _.keys(this.handlersByEntity).includes(entity);
    if (prefixExists && entityExists) {
      return true;
    }
    if (!prefixExists && !entityExists) {
      return false;
    }
    Logger.error(`${prefix} or ${entity} already exists in id generators.`);
    // throw new AsunaException(AsunaErrorCode.Unprocessable, `${prefix} or ${entity} already exists in id generators.`);
    return false;
  }

  public static reg(prefix: string, entity: string): void {
    // this.exists(prefix, entity);
    this.handlers[prefix] = new SimpleIdGenerator(prefix);
    this.handlersByEntity[entity] = this.handlers[prefix];
  }

  public static nextId(prefix: string): string {
    if (!_.keys(this.handlers).includes(prefix)) {
      throw new AsunaException(AsunaErrorCode.Unprocessable, `prefix ${prefix} not found in id generators.`);
    }
    return this.handlers[prefix].nextId();
  }

  public static nextIdByEntity(entity: string): string {
    if (!_.keys(this.handlersByEntity).includes(entity)) {
      throw new AsunaException(AsunaErrorCode.Unprocessable, `entity ${entity} not found in id generators.`);
    }
    return this.handlersByEntity[entity].nextId();
  }
}
