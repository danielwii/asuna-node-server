import { Logger } from '@nestjs/common';

import { r } from '@danielwii/asuna-helper/dist/serializer';

import { DaprConfigObject } from './dapr.config';

export class DaprProvider {
  private readonly _stateUrl;

  private static instance = new DaprProvider();

  public static get _(): DaprProvider {
    return this.instance;
  }

  public get enabled(): boolean {
    return DaprConfigObject.load().enable;
  }

  public get stateUrl(): string {
    return this._stateUrl;
  }

  private constructor() {
    const config = DaprConfigObject.load();
    Logger.log(`init with ${r(config)}`);
    this._stateUrl = `http://localhost:${config.port}/v1.0/state`;
  }
}
