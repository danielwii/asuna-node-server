import { Logger, Module, OnModuleInit } from '@nestjs/common';

import { EventsGateway } from './events.gateway';

const logger = new Logger('WsModule');

@Module({
  providers: [EventsGateway],
})
export class WsModule implements OnModuleInit {
  public onModuleInit() {
    logger.log('init...');
  }
}
