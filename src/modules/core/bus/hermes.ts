import { Logger } from '@nestjs/common';
import { Job, Queue, QueueOptions } from 'bull';
import { validate } from 'class-validator';
import * as _ from 'lodash';
import * as Rx from 'rxjs';
import { isBlank, r } from '../../common';
import { RedisConfigObject } from '../../providers';
import { AbstractAuthUser } from '../auth';
import { ConfigKeys, configLoader } from '../config.helper';

const assert = require('assert');
const Queue = require('bull');

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

export const AsunaSystemQueue = {
  UPLOAD: 'UPLOAD',
  IN_MEMORY_UPLOAD: 'IN_MEMORY_UPLOAD',
};

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

export type AsunaQueue = {
  name: string;
  opts?: QueueOptions;
  queue: Queue;
  processor?: (payload: any) => Promise<any>;
};

export interface InMemoryAsunaQueue {
  name: string;
  queue: Rx.Subject<any>;
  processor?: (payload: any) => Promise<any>;
}

export class Hermes {
  private static subject = new Rx.Subject<IAsunaEvent>();
  private static observers: AsunaObserver[];
  private static initialized: boolean;

  private static INSTNACE = new Hermes();

  private static queues: { [key: string]: AsunaQueue };
  private static inMemoryQueues: { [key: string]: InMemoryAsunaQueue };

  constructor() {
    this.initialize();
  }

  initialize() {
    if (Hermes.initialized) {
      return;
    }

    logger.log('init ...');
    Hermes.observers = [];
    Hermes.queues = {};
    Hermes.inMemoryQueues = {};

    Hermes.subject.subscribe(
      (event: IAsunaEvent) => {
        Hermes.observers.forEach(observer => {
          if (observer.routePattern !== 'fanout' && !observer.routePattern.test(event.name)) {
            return;
          }
          observer.next(event);
        });
      },
      error => logger.error(`error occurred: ${error}`, error.trace),
      () => logger.log('Hermes completed'),
    );

    const configObject = RedisConfigObject.loadOr('job');
    logger.log(`init queues...${r(configObject, true)}`);
    if (configObject && configObject.enable) {
      const db = configLoader.loadConfig(ConfigKeys.JOB_REDIS_DB, 1);
      logger.log(`init job with redis db: ${db}`);
      Hermes.regQueue(AsunaSystemQueue.UPLOAD, { redis: configObject.getOptions(db) });
    }

    Hermes.regInMemoryQueue(AsunaSystemQueue.IN_MEMORY_UPLOAD);
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
    extras?: { user?: AbstractAuthUser; type?: string },
  ) {
    logger.log(`emit events from [${source}]: {${event}}${JSON.stringify(payload)}`);
    this.subject.next(
      new AsunaEvent({
        name: event,
        payload,
        source,
        user: _.get(extras, 'user'),
        type: _.get(extras, 'type'),
      }),
    );
  }

  static regInMemoryQueue(queueName: string): InMemoryAsunaQueue {
    assert.strictEqual(isBlank(queueName), false, 'queue name must be defined');

    if (this.inMemoryQueues[queueName]) {
      return this.inMemoryQueues[name];
    }

    logger.log(`reg in-memory queue: ${queueName}`);
    const subject = new Rx.Subject();
    subject.subscribe(
      payload => {
        logger.log(`queue(${queueName}) run job ${r(payload)}`);
        this.getInMemoryQueue(queueName).processor != null
          ? this.getInMemoryQueue(queueName).processor(payload)
          : Promise.reject(`no processor registered for ${queueName}`);
      },
      error => {
        logger.warn(`error occurred in ${queueName}: ${r(error)}`);
      },
    );
    this.inMemoryQueues[queueName] = { name: queueName, queue: subject };
  }

  static getInMemoryQueue(queueName: string): InMemoryAsunaQueue {
    return this.inMemoryQueues[queueName];
  }

  static regQueue(queueName: string, opts?: QueueOptions): AsunaQueue {
    assert.strictEqual(isBlank(queueName), false, 'queue name must be defined');

    if (this.queues[queueName]) {
      return this.queues[name];
    }

    const queue = new Queue(queueName, opts);
    queue.process((job: Job) => {
      logger.log(`queue(${queueName}) run job ${job.name} with ${r(job.data)}`);
      return this.getQueue(queueName).processor != null
        ? this.getQueue(queueName).processor(job)
        : Promise.reject(`no processor registered for ${queueName}`);
    });
    this.queues[queueName] = { name: queueName, opts, queue };
    return this.queues[queueName];
  }

  static getQueue(queueName: string): AsunaQueue {
    return this.queues[queueName];
  }

  /**
   * return index
   * @param queueName
   * @param processor
   */
  static setupJobProcessor(queueName: string, processor: (payload: any) => Promise<any>): void {
    assert.strictEqual(isBlank(queueName), false, 'queue name must not be empty');

    let queue;
    queue = queueName.startsWith('IN_MEMORY_')
      ? this.getInMemoryQueue(queueName)
      : this.getQueue(queueName);
    if (!queue) {
      logger.error(`queue(${queueName}) not found`);
      return;
    }
    queue.processor = processor;
  }

  static subscribe(
    source: string,
    routePattern: 'fanout' | RegExp,
    next?: (event: IAsunaEvent) => void,
  ): void {
    logger.log(`subscribe from [${source}] ... total: ${this.observers.length + 1}`);
    this.observers.push({ source, routePattern, next });
    // this.subject.subscribe(observer);
  }
}
