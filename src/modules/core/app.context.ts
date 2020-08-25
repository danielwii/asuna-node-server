import { LoggerFactory } from '../common/logger';

const logger = LoggerFactory.getLogger('AppContext');

export class AppContext {
  public static readonly instance = new AppContext();

  private state = {
    version: process.env.npm_package_version,
    upTime: new Date(),
  };

  private constructor() {
    logger.log('constructor...');
  }

  get version() {
    return this.state.version;
  }

  get upTime(): Date {
    return this.state.upTime;
  }
}
