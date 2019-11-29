import { r } from '../common/helpers';
import { LoggerFactory } from '../common/logger';
import { DaprConfigObject } from './dapr.config';

const logger = LoggerFactory.getLogger('DaprProvider');

export class DaprProvider {
  private _stateUrl;

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
    logger.log(`init with ${r(config)}`);
    this._stateUrl = `http://localhost:${config.port}/v1.0/state`;
  }
}
