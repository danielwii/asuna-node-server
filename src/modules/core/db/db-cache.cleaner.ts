import { Logger } from '@nestjs/common';

import { r } from '@danielwii/asuna-helper/dist/serializer';

import _ from 'lodash';
import fp from 'lodash/fp';

import { AppDataSource } from '../../datasource';
import { named } from '../../helper/annotations';

import type { BaseEntity } from 'typeorm';

export class DBCacheCleaner {
  public static registers: { Entity: typeof BaseEntity; trigger: string }[] = [];

  public static regTrigger(Entity: typeof BaseEntity, trigger: string): void {
    this.registers.push({ Entity, trigger });
  }

  @named
  public static clear(name: string, funcName?: string): void {
    const triggers = _.flow([
      fp.filter(({ Entity, trigger }) => {
        if (!Entity) Logger.error(`no entity found for trigger: ${trigger}.`);
        return !!Entity;
      }),
      fp.filter(({ Entity }) => Entity.name === name),
      fp.map(fp.get('trigger')),
    ])(this.registers);
    if (!_.isEmpty(triggers)) {
      Logger.debug(`#DBCacheCleaner.${funcName}: clear ${r(triggers)}`);
      AppDataSource.dataSource.queryResultCache?.remove(triggers).catch((reason) => Logger.error(reason));
    }
  }
}
