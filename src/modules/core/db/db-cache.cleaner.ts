import { Logger } from '@nestjs/common';

import { r } from '@danielwii/asuna-helper/dist/serializer';

import _ from 'lodash';
import * as fp from 'lodash/fp';
import { BaseEntity } from 'typeorm';

import { AppDataSource } from '../../datasource';

export class DBCacheCleaner {
  public static registers: { Entity: typeof BaseEntity; trigger: string }[] = [];

  public static regTrigger(Entity: typeof BaseEntity, trigger: string): void {
    this.registers.push({ Entity, trigger });
  }

  public static clear(name: string): void {
    const triggers = _.flow([
      fp.filter(({ Entity, trigger }) => {
        if (!Entity) Logger.error(`no entity found for trigger: ${trigger}.`);
        return !!Entity;
      }),
      fp.filter(({ Entity }) => Entity.name === name),
      fp.map(fp.get('trigger')),
    ])(this.registers);
    if (!_.isEmpty(triggers)) {
      Logger.debug(`clear ${r(triggers)}`);
      AppDataSource.dataSource.queryResultCache?.remove(triggers).catch((reason) => Logger.error(reason));
    }
  }
}
