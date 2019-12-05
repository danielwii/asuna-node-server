import { Injectable } from '@nestjs/common';
import { InjectConnection } from '@nestjs/typeorm';
import * as LRU from 'lru-cache';
import { Connection, Repository } from 'typeorm';
import { LoggerFactory } from '../common/logger';

import { Device } from './device.entities';

const logger = LoggerFactory.getLogger('cache');

const cache = new LRU<string, DeviceShadow>({
  max: 2000,
  maxAge: 60 * 60 * 1e3,
});

class DeviceShadow {
  private logger = LoggerFactory.getLogger('DeviceShadow');

  constructor(private readonly uuid: string) {}

  sync(): void {
    this.logger.log(`sync device ${this.uuid}`);
  }
}

@Injectable()
export class DeviceService {
  private readonly logger = LoggerFactory.getLogger('DeviceService');

  private readonly deviceRepository: Repository<Device>;

  constructor(@InjectConnection() private readonly connection: Connection) {
    this.deviceRepository = connection.getRepository<Device>(Device);
  }

  getDeviceShadow(uuid: string): DeviceShadow {
    if (!uuid) {
      return null;
    }

    let shadow = cache.get(uuid);
    if (!shadow) {
      shadow = new DeviceShadow(uuid);
      cache.set(uuid, shadow);
    }
    return shadow;
  }
}
