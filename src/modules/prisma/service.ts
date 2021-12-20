import { PrismaClient } from '@prisma/client';

import { INestApplication, Injectable, Logger, OnModuleInit } from '@nestjs/common';

import { LoggerFactory } from '@danielwii/asuna-helper/dist';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  private readonly logger = LoggerFactory.getLogger(PrismaService.name);

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
    this.logger.log('connect to db...');
    await this.$connect();

    this.$on('query' as any, (e: any) => {
      if (e.duration > 1000) {
        this.logger.debug('Timestamp: ' + e.timestamp);
        this.logger.debug('Query: ' + e.query);
        this.logger.debug('Params: ' + e.params);
        this.logger.debug('Duration: ' + e.duration + 'ms');
      }
    });
  }

  public async enableShutdownHooks(app: INestApplication) {
    this.$on('beforeExit', async () => {
      this.logger.log('shutdown db...');
      await app.close();
    });
  }
}
