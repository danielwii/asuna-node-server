import { Module, OnModuleInit } from '@nestjs/common';
import { LoggerFactory } from '../common/logger';
import { ClientService } from './client.service';

const logger = LoggerFactory.getLogger('ClientModule');

@Module({
  providers: [ClientService],
  // exports: [ClientService],
})
export class ClientModule implements OnModuleInit {
  onModuleInit(): void {
    logger.log('init...');
  }
}
