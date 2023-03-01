import { CanActivate, ExecutionContext, Injectable, Logger, NotImplementedException } from '@nestjs/common';

import { resolveModule } from '@danielwii/asuna-helper/dist/logger/factory';
import { r } from '@danielwii/asuna-helper/dist/serializer';

import { fileURLToPath } from 'node:url';

import { AppLifecycle } from '../../lifecycle';
import { ActivityService } from './service';

import type { EntityConstructorObject } from '../base/base.entity';
import type { RequestInfo } from '../helper';
import type { Activity } from './entities';

@Injectable()
export class ActivityGuard implements CanActivate {
  private readonly logger = new Logger(resolveModule(fileURLToPath(import.meta.url), this.constructor.name));

  public constructor(
    private readonly name: string,
    private readonly resolver: (data) => Omit<EntityConstructorObject<Activity>, 'name'>,
  ) {}

  canActivate(context: ExecutionContext) {
    const service = AppLifecycle._.getApp().get(ActivityService);
    const req = context.switchToHttp().getRequest<RequestInfo>();
    const data = this.resolver(req.body);
    this.logger.log(`check url: ${req.url} ${r({ name: this.name, body: req.body, data })}`);
    // service.create(req.user?.id, this.name, data);
    return false;
  }
}
