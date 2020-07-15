import * as BullQueue from 'bull';
import { validate } from 'class-validator';
import * as _ from 'lodash';
import ow from 'ow';
import { defer, Observable, of, Subject, throwError } from 'rxjs';
import { fromPromise } from 'rxjs/internal-compatibility';
import { concatAll, map } from 'rxjs/operators';
import { r } from '../../common';
import { LoggerFactory } from '../../common/logger';
import { ConfigKeys, configLoader } from '../../config';
import { RedisConfigObject } from '../../providers';
import { AbstractAuthUser } from '../auth/base.entities';
import { random } from '../helpers/random.helper';
import { IAsunaAction, IAsunaCommand, IAsunaEvent, IAsunaJob, IAsunaObserver, IAsunaRule } from './interfaces';

const logger = LoggerFactory.getLogger('Hermes');

export const AsunaSystemQueue = {
  UPLOAD: 'UPLOAD',
  IN_MEMORY_UPLOAD: 'IN_MEMORY_UPLOAD',
  IN_MEMORY_JOB: 'IN_MEMORY_JOB',
};

export class AsunaEvent implements IAsunaEvent {
  payload: any;

  source: string;

  name: string;

  type: string;

  createdAt: any;

  createdBy: any;

  rules: IAsunaRule[];

  identifier: any;

  constructor(opts: {
    payload: any;
    source: string;
    name: string;
    type?: any;
    user?: AbstractAuthUser;
    identifier?: any;
  }) {
    this.payload = opts.payload;
    this.source = opts.source;
    this.name = opts.name;
    this.type = opts.type;
    this.createdBy = opts.user;
    this.createdAt = Date.now();
    this.identifier = opts.identifier;
  }
}

export type AsunaQueue = {
  name: string;
  opts?: BullQueue.QueueOptions;
  queue: BullQueue.Queue;
  handle?: (payload: any) => Promise<any>;
};

export type EventRuleResolver = {
  identifier: { version: 'default/v1alpha'; type: 'EventRule' };
  resolve: (event: IAsunaEvent) => IAsunaAction[];
};

export type CommandResolver = {
  identifier: { version: 'default/v1alpha'; type: 'Command' };
  resolve: (command: IAsunaCommand) => IAsunaEvent[];
};

export class HermesExchange {
  private static _commands: IAsunaCommand[];

  private static _resolvers: { [key: string]: CommandResolver } = {};

  private static _eventRules: { [key: string]: EventRuleResolver } = {};

  static get resolvers() {
    return HermesExchange._resolvers;
  }

  static regCommandResolver(key: string, commandResolver: CommandResolver) {
    this._resolvers[key] = commandResolver;
  }

  static regEventRule(key: string, eventRuleResolver: EventRuleResolver) {
    this._eventRules[key] = eventRuleResolver;
  }
}

export class Hermes {
  private static subject = new Subject<IAsunaEvent>();

  private static observers: IAsunaObserver[];

  private static initialized: boolean;

  private static instance = new Hermes();

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
        Hermes.observers.forEach((observer) => {
          if (observer.routePattern !== 'fanout' && !observer.routePattern.test(event.name)) {
            return;
          }
          observer.next(event);
        });
      },
      (error) => logger.error(`error occurred: ${error}`, error.trace),
      () => logger.log('Hermes completed'),
    );

    const configObject = RedisConfigObject.loadOr('job');
    logger.log(`init queues with redis: ${r(configObject, { transform: true })}`);
    if (configObject.enable) {
      const db = configLoader.loadNumericConfig(ConfigKeys.JOB_REDIS_DB, 1);
      logger.log(`init job with redis db: ${db}`);
      // redis.ClientOpts have to convert to ioredis.RedisOptions
      Hermes.regQueue(AsunaSystemQueue.UPLOAD, { redis: configObject.getOptions(db) as any });

      logger.log('sync status with redis.');
    }

    Hermes.regInMemoryQueue(AsunaSystemQueue.IN_MEMORY_UPLOAD);
  }

  static emitEvents(source: string, events: IAsunaEvent[]) {
    logger.log(`emit events from [${source}]: ${r(events)}`);
    if (events && events.length > 0) {
      events.forEach(async (event) => {
        const errors = await validate(event);
        if (errors && errors.length > 0) {
          return logger.warn(`validate error. event: ${r(event)}, errors: ${r(errors)}`);
        }
        return event && this.subject.next(event);
      });
    }
  }

  static emit(
    source: string,
    event: string,
    payload: any,
    extras: { identifier?: any; user?: AbstractAuthUser; type?: string } = {},
  ) {
    logger.log(`emit events from [${source}: ${event}]`);
    this.subject.next(
      new AsunaEvent({
        name: event,
        payload,
        source,
        user: extras.user,
        type: extras.type,
        identifier: extras.identifier,
      }),
    );
  }

  static regInMemoryQueue(queueName: string): InMemoryAsunaQueue {
    ow(queueName, 'queueName', ow.string.nonEmpty);

    if (this.inMemoryQueues[queueName]) {
      return this.inMemoryQueues[queueName];
    }

    logger.log(`reg in-memory queue: ${queueName}`);
    const subject = new Subject();
    subject
      .pipe(
        map(({ jobId, data }) => {
          logger.log(`job(${jobId}) call func in map ... data: ${r(data)}`);
          const inMemoryQueue = Hermes.getInMemoryQueue(queueName);
          const status = inMemoryQueue.status[jobId];
          if (typeof inMemoryQueue.handle !== 'function') {
            const message = `no handler registered for ${queueName}`;
            logger.error(message);
            status.state = 'UN_READY';
            status.events.push({
              state: 'UN_READY',
              at: new Date().toUTCString(),
              message,
            });
            return of({
              jobId,
              data,
              result: { error: message },
            });
          }

          return defer(() => {
            logger.log(`job(${jobId}) call func in defer ...`);
            status.state = 'RUNNING';
            status.events.push({
              state: 'RUNNING',
              at: new Date().toUTCString(),
            });
            // execute the function and then examine the returned value.
            // if the returned value is *not* an Rx.Observable, then
            // wrap it using Observable.return
            const result = inMemoryQueue.handle(data);
            const isPromise = typeof result.then === 'function';
            logger.log(`job(${jobId}) call func in defer ... result is ${r(result)} ${typeof result}`);
            if (isPromise) {
              return fromPromise<any>(result.then((value) => ({ result: value, jobId, data })));
            }
            return result instanceof Observable ? of({ jobId, data, result }) : of(result);
          });
        }),
        concatAll(),
      )
      .subscribe(
        ({ jobId, data, result }) => {
          logger.log(`job(${jobId}) queue(${queueName}) run ${r(data)} with result ${r(result)}`);

          const status = this.getInMemoryQueue(queueName).status[jobId];
          if (result.error) {
            return throwError({ jobId, data, result });
          }

          status.state = 'DONE';
          status.events.push({
            state: 'DONE',
            at: new Date().toUTCString(),
          });
        },
        (error) => {
          const { jobId, data } = error;
          logger.warn(`job(${jobId}) error occurred in ${queueName}: ${r(error)}`);
          if (jobId && this.getInMemoryQueue(queueName).status[jobId]) {
            const status = this.getInMemoryQueue(queueName).status[jobId];
            status.state = 'ERROR';
            status.events.push({
              state: 'ERROR',
              at: new Date().toUTCString(),
              message: data,
            });
          }
        },
      );

    const status = {};
    this.inMemoryQueues[queueName] = {
      name: queueName,
      queue: subject,
      status,
      next(data) {
        const jobId = random(6);
        this.status[jobId] = {
          state: 'PENDING',
          events: [{ state: 'PENDING', at: new Date().toUTCString() }],
        };
        logger.log(`job(${jobId}) pending ... ${r({ data, status: this.status[jobId] })}`);
        subject.next({ jobId, data });
        return { jobId };
      },
    };
    return this.getInMemoryQueue(queueName);
  }

  static getInMemoryQueue(queueName: string): InMemoryAsunaQueue {
    return this.inMemoryQueues[queueName];
  }

  static regQueue(queueName: string, opts?: BullQueue.QueueOptions): AsunaQueue {
    ow(queueName, 'queueName', ow.string.nonEmpty);

    if (this.queues[queueName]) {
      return this.queues[queueName];
    }

    const queue = new BullQueue(queueName, opts);
    queue.process((job: BullQueue.Job, done) => {
      logger.log(`queue(${queueName}) run job ${job.name} with ${r(job.data)}`);
      return this.getQueue(queueName).handle != null
        ? this.getQueue(queueName).handle(job)
        : done(new Error(`no processor registered for ${queueName}`));
    });
    this.queues[queueName] = { name: queueName, opts, queue };
    return this.getQueue(queueName);
  }

  static getQueue(queueName: string): AsunaQueue {
    return this.queues[queueName];
  }

  /**
   * return index
   * @param queueName
   * @param handle
   */
  static setupJobProcessor(queueName: string, handle: (payload: any) => Promise<any>): void {
    ow(queueName, 'queueName', ow.string.nonEmpty);

    const queue = queueName.startsWith('IN_MEMORY_') ? this.getInMemoryQueue(queueName) : this.getQueue(queueName);
    if (!queue) {
      logger.error(`queue(${queueName}) not found`);
      return;
    }
    queue.handle = handle;
  }

  static subscribe(source: string, routePattern: 'fanout' | RegExp, next?: (event: IAsunaEvent) => void): void {
    logger.log(`subscribe from [${source}] ... total: ${this.observers.length + 1}`);
    this.observers.push({ source, routePattern, next });
    // this.subject.subscribe(observer);
  }
}

export class HermesProcessManager {
  static initialized: boolean;

  static queue: InMemoryAsunaQueue;

  static start() {
    if (!this.initialized) {
      this.initialized = true;

      logger.log('initialize process manager');
      this.queue = Hermes.regInMemoryQueue(AsunaSystemQueue.IN_MEMORY_JOB);
      Hermes.setupJobProcessor(AsunaSystemQueue.IN_MEMORY_JOB, (job: IAsunaJob) => {
        logger.log(`jobProcessor job: ${r(job)}`);
        if (!job) {
          throw new Error(`no job received in processor at queue: ${AsunaSystemQueue.IN_MEMORY_JOB}`);
        }
        return job.process(job.payload);
      });
    }
  }

  static handleCommand(command: IAsunaCommand) {
    _.forEach(HermesExchange.resolvers, (resolver: CommandResolver) => {
      logger.log(`check command ${r(command)} with resolver: ${r(resolver.identifier)}`);
      if (_.isMatch(command, resolver.identifier)) {
        logger.log(`matched command with identifier ${r(resolver.identifier)}`);
        const events = resolver.resolve(command);
        if (!events) {
          logger.warn(`no events parsed from command: ${r(command)}`);
          return;
        }
        events.forEach((event) => {
          logger.log(`handle event: ${r(event)}`);
          this.dispatch(event);
        });
        // eslint-disable-next-line no-param-reassign
        command.events = events;
      }
    });
  }

  static dispatch(event: IAsunaEvent) {
    if (event.rules && event.rules.length > 0) {
      event.rules.forEach((rule) => {
        logger.log(`handle rule ${r(rule)}`);
        if (rule.actions && rule.actions.length > 0) {
          rule.actions.forEach((action) => {
            logger.log(`add jobs to queue in action: ${r(action)}`);
            if (action.jobs && action.jobs.length > 0) {
              action.jobs.forEach((job) => {
                logger.log(`send ${r(job)} to queue ${this.queue.name}`);
                // this.queue.queue.next(job);
                // eslint-disable-next-line no-param-reassign
                job.state = 'OPEN';
                const { jobId } = this.queue.next(job);
                // eslint-disable-next-line no-param-reassign
                job.id = jobId;
              });
            }
          });
        }
      });
    }
  }
}

export class AsunaDefaultEvent implements IAsunaEvent {
  createdAt: any;

  createdBy: any;

  name: string;

  payload: any;

  rules: IAsunaRule[];

  source: string;

  type: string;

  constructor(name: string, source: string, type: string, data: any, process: (data) => Promise<any>) {
    this.name = name;
    this.rules = [
      new (class implements IAsunaRule {
        actions: IAsunaAction[];

        createdAt: any;

        createdBy: any;

        name: string;

        payload: any;

        source: string;

        type: string;

        constructor() {
          this.actions = [
            new (class implements IAsunaAction {
              createdAt: any;

              createdBy: any;

              jobs: IAsunaJob[];

              name: string;

              payload: any;

              source: string;

              type: string;

              constructor() {
                this.jobs = [
                  new (class implements IAsunaJob {
                    createdAt: any;

                    createdBy: any;

                    name: string;

                    payload: any;

                    source: string;

                    type: string;

                    process: (data) => Promise<any>;

                    constructor() {
                      this.payload = data;
                      this.process = process;
                    }
                  })(),
                ];
              }
            })(),
          ];
        }
      })(),
    ];
    this.source = source;
    this.type = type;
  }
}

export interface InMemoryAsunaQueue {
  name: string;
  queue: Subject<any>;
  next: (data: any) => { jobId: string };
  handle?: (payload: any) => Promise<any>;
  status?: { [jobId: string]: { state: string; events: any[] } };
}
