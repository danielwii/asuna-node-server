import * as Rx from 'rxjs';
import { Logger } from '@nestjs/common';

const logger = new Logger('Hermes');

export class Hermes {
  private static observable: Rx.Observable<any>;
  private static subscriber: Rx.Subscriber<any>;

  private static subjects = [];
  private static events = [];

  constructor() {
    logger.log('init ...');
    if (!Hermes.observable) {
      Hermes.observable = new Rx.Observable(subscriber => {
        Hermes.subscriber = subscriber;
      });
    }
  }

  static emit(source: string, event: string, payload: any) {
    logger.log(`emit from ${source}: {${event}}{${JSON.stringify(payload)}`);
    this.events.push(event);
    this.subscriber.next({ event, payload });
  }

  static subscribe(source: string, subject: Rx.Subject<any>) {
    logger.log(`subscribe from ${source}: ${subject} ... total: ${this.subjects.length}`);
    this.subjects.push({ source, subject });
    this.observable.subscribe(subject);
  }
}
