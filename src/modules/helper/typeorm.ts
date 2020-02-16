import { getManager } from 'typeorm';
import { LoggerFactory } from '../common/logger';

const logger = LoggerFactory.getLogger('TypeormHelper');

export class TypeormHelper {
  static mapSeries(callPromises: (entityManager) => Promise<any>[]): Promise<void> {
    return new Promise(resolve => {
      getManager()
        .transaction(async entityManager => {
          await Promise.all(callPromises(entityManager));
          resolve();
        })
        .catch(reason => logger.error(reason));
    });
  }
}
