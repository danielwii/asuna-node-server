import { Logger } from '@nestjs/common';

import { AppDataSource } from '../datasource';

export class TypeormHelper {
  public static mapSeries(callPromises: (entityManager) => Promise<any>[]): Promise<void> {
    return new Promise((resolve) => {
      AppDataSource.dataSource.manager
        .transaction(async (entityManager) => {
          await Promise.all(callPromises(entityManager));
          resolve();
        })
        .catch((reason) => Logger.error(reason));
    });
  }
}
