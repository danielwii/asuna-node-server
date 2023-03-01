import { Global, Logger, Module, OnModuleInit } from '@nestjs/common';

import { InitContainer } from '@danielwii/asuna-helper/dist/init';
import { resolveModule } from '@danielwii/asuna-helper/dist/logger/factory';
import { r } from '@danielwii/asuna-helper/dist/serializer';

import { fileURLToPath } from 'node:url';

import { ActivityService } from './service';

@Global()
@Module({
  providers: [ActivityService],
  exports: [ActivityService],
})
export class ActivityModule extends InitContainer implements OnModuleInit {
  private readonly logger = new Logger(resolveModule(fileURLToPath(import.meta.url), this.constructor.name));

  constructor(private readonly activityService: ActivityService) {
    super();
  }

  onModuleInit = () =>
    super.init(async () => {
      const names = await this.activityService.listActivityNames();
      this.logger.log(`activity names: ${r(names)}`);
    });
}
