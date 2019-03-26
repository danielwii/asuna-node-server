import * as Rx from 'rxjs';
import { Logger } from '@nestjs/common';

const logger = new Logger('Hermes');

export class Hermes {
  private static subject = new Rx.Subject<any>();

  private static observers = [];
  private static events = [];

  static emit(source: string, event: string, payload: any) {
    logger.log(`emit from ${source}: {${event}}{${JSON.stringify(payload)}`);
    // this.events.push(event);
    this.subject.next({ event, payload });
  }

  static subscribe(source: string, observer?: Rx.PartialObserver<any>) {
    logger.log(`subscribe from ${source} ... total: ${this.observers.length}`);
    this.observers.push({ source, observer });
    this.subject.subscribe(observer);
  }
}
