import { Logger } from '@nestjs/common';
import { validate } from 'class-validator';
import * as Rx from 'rxjs';

import { AbstractAuthUser } from '../core/auth';

const logger = new Logger('Hermes');

export interface IAsunaEvent {
  payload: any;
  source: string;
  name: string;
  type: string;
  createdBy: any;
  createdAt: any;
}

export interface AsunaObserver {
  source: string;
  routePattern: 'fanout' | RegExp;
  next: (event: IAsunaEvent) => void;
}

export class AsunaEvent implements IAsunaEvent {
  payload: any;
  source: string;
  name: string;
  type: string;
  createdAt: any;
  createdBy: any;

  constructor(opts: {
    payload: any;
    source: string;
    name: string;
    type: any;
    user: AbstractAuthUser;
  }) {
    this.payload = opts.payload;
    this.source = opts.source;
    this.name = opts.name;
    this.type = opts.type;
    this.createdBy = opts.user;
    this.createdAt = Date.now();
  }
}

export class Hermes {
  private static subject = new Rx.Subject<IAsunaEvent>();
  private static observers: AsunaObserver[] = [];
  private static initialized: boolean;

  private static INSTNACE = new Hermes();

  constructor() {
    this.initialize();
  }

  initialize() {
    if (Hermes.initialized) {
      return;
    }

    logger.log('init ...');
    Hermes.subject.subscribe(
      (event: IAsunaEvent) => {
        Hermes.observers.forEach(observer => {
          if (observer.routePattern != 'fanout' && !observer.routePattern.test(event.name)) {
            return;
          }
          observer.next(event);
        });
      },
      error => logger.error(`error occurred: ${error}`, error.trace),
      () => logger.log('Hermes completed'),
    );
  }

  static emitEvents(source: string, events: IAsunaEvent[]) {
    logger.log(`emit events from [${source}]: ${JSON.stringify(events)}`);
    if (events && events.length) {
      events.forEach(async event => {
        const errors = await validate(event);
        if (errors && errors.length) {
          return logger.warn(
            `validate error. event: ${JSON.stringify(event)}, errors: ${JSON.stringify(errors)}`,
          );
        }
        return event && this.subject.next(event);
      });
    }
  }

  static emit(
    source: string,
    event: string,
    payload: any,
    extras?: { user: AbstractAuthUser; type: string },
  ) {
    logger.log(`emit events from [${source}]: {${event}}${JSON.stringify(payload)}`);
    this.subject.next(
      new AsunaEvent({ name: event, payload, source, user: extras.user, type: extras.type }),
    );
  }

  static subscribe(
    source: string,
    routePattern: 'fanout' | RegExp,
    next?: (event: IAsunaEvent) => void,
  ) {
    logger.log(`subscribe from [${source}] ... total: ${this.observers.length + 1}`);
    this.observers.push({ source, routePattern, next });
    // this.subject.subscribe(observer);
  }
}
