import { LoggerFactory } from '@danielwii/asuna-helper/dist/logger/factory';
import { r } from '@danielwii/asuna-helper/dist/serializer';

import _ from 'lodash';
import * as fp from 'lodash/fp';
import { BaseEntity, getConnection } from 'typeorm';

const logger = LoggerFactory.getLogger('DBCacheCleaner');

export class DBCacheCleaner {
  public static registers: { Entity: typeof BaseEntity; trigger: string }[] = [];

  public static regTrigger(Entity: typeof BaseEntity, trigger: string): void {
    this.registers.push({ Entity, trigger });
  }

  public static clear(name: string): void {
    const triggers = _.flow([
      fp.filter(({ Entity, trigger }) => {
        if (!Entity) logger.error(`no entity found for trigger: ${trigger}.`);
        return !!Entity;
      }),
      fp.filter(({ Entity }) => Entity.name === name),
      fp.map(fp.get('trigger')),
    ])(this.registers);
    if (!_.isEmpty(triggers)) {
      logger.debug(`clear ${r(triggers)}`);
      getConnection()
        .queryResultCache?.remove(triggers)
        .catch((reason) => logger.error(reason));
    }
  }
}
