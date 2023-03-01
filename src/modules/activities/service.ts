import { Injectable, Logger } from '@nestjs/common';

import { resolveModule } from '@danielwii/asuna-helper/dist/logger/factory';
import { r } from '@danielwii/asuna-helper/dist/serializer';

import { fileURLToPath } from 'node:url';

import { named } from '../helper/annotations';
import { Activity } from './entities';

import type { EntityConstructorObject } from '../base/base.entity';

@Injectable()
export class ActivityService {
  private readonly logger = new Logger(resolveModule(fileURLToPath(import.meta.url), this.constructor.name));

  @named
  public async create(
    caller: string,
    name: string,
    data: Omit<EntityConstructorObject<Activity>, 'name'>,
    funcName?: string,
  ) {
    this.logger.log(`(${name}) #${funcName}: ${r(data)}`);
    return Activity.create({ ...data, name, createdBy: caller }).save();
  }

  @named
  public async listActivityNames() {
    // list all unique names of activities in database
    return Activity.createQueryBuilder().select('DISTINCT name').getRawMany();
  }
}
