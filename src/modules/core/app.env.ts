import { r } from '../common/helpers/utils';
import { LoggerFactory } from '../common/logger';

const logger = LoggerFactory.getLogger('AppEnv');

export class AppEnv {
  public static readonly instance = new AppEnv();

  private state = {
    version: process.env.npm_package_version,
    upTime: new Date(),
  };

  private constructor() {
    logger.log(`initialized. ${r(this.state)}`);
  }

  get version() {
    return this.state.version;
  }

  get upTime(): Date {
    return this.state.upTime;
  }
}
