import { Logger, Module, OnModuleInit } from '@nestjs/common';

import { EventsGateway } from './events.gateway';

const logger = new Logger('EventsModule');

@Module({
  providers: [EventsGateway],
})
export class EventsModule implements OnModuleInit {
  public onModuleInit() {
    logger.log('init...');
  }
}
