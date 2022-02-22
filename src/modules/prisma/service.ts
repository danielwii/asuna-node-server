import { PrismaClient } from '@prisma/client';

import { INestApplication, Injectable, OnModuleInit } from '@nestjs/common';

import { LoggerFactory } from '@danielwii/asuna-helper/dist/logger/factory';
import { r } from '@danielwii/asuna-helper/dist/serializer';

const logger = LoggerFactory.getLogger('PrismaService<PrismaClient>');

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  public constructor() {
    super({
      log: [
        { emit: 'event', level: 'query' },
        // 'query',
        'info',
        `warn`,
        `error`,
      ],
    });
  }

  public async onModuleInit() {
    logger.log('connect to db...');
    await this.$connect().catch((reason) => {
      logger.error(`connect to db error ${r(reason)}`);
      throw reason;
    });

    this.$on('query' as any, (e: any) => {
      if (e.duration > 1000) {
        logger.debug('Timestamp: ' + e.timestamp);
        logger.debug('Query: ' + e.query);
        logger.debug('Params: ' + e.params);
        logger.debug('Duration: ' + e.duration + 'ms');
      }
    });
  }

  public async enableShutdownHooks(app: INestApplication) {
    this.$on('beforeExit', async () => {
      logger.log('shutdown db...');
      await app.close();
    });
  }
}
