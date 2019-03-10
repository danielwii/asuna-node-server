import { Logger } from '@nestjs/common';

const pkg = require('../../../package.json');

const logger = new Logger('AppContext');

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
