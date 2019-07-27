import { LoggerFactory } from '../common/logger';

const pkg = require('../../../package.json');

const logger = LoggerFactory.getLogger('AppContext');

export class AppContext {
  public static instance = new AppContext();

  private state = {
    version: pkg.version,
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
