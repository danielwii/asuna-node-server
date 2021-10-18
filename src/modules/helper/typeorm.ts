import { LoggerFactory } from '@danielwii/asuna-helper/dist/logger/factory';

import { getManager } from 'typeorm';

const logger = LoggerFactory.getLogger('TypeormHelper');

export class TypeormHelper {
  public static mapSeries(callPromises: (entityManager) => Promise<any>[]): Promise<void> {
    return new Promise((resolve) => {
      getManager()
        .transaction(async (entityManager) => {
          await Promise.all(callPromises(entityManager));
          resolve();
        })
        .catch((reason) => logger.error(reason));
    });
  }
}
