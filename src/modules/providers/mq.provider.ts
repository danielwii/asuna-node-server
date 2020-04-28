import { Injectable } from '@nestjs/common';
import * as amqp from 'amqplib';
import { r } from '../common/helpers';
import { LoggerFactory } from '../common/logger';
import { MQConfigObject } from './mq.config';

const logger = LoggerFactory.getLogger('MQProvider');

@Injectable()
export class MQProvider {
  private static _instance: MQProvider = new MQProvider();

  #connectionFuture: amqp.Connection;
  #channel: amqp.Channel;
  // private _retryLimit = 10;

  // eslint-disable-next-line @typescript-eslint/no-empty-function
  private constructor() {}

  private async createConnection(): Promise<amqp.Connection> {
    if (MQProvider.enabled) {
      const { url } = MQConfigObject.load();
      logger.log(`connecting to ${url}`);
      const connection = await amqp.connect(url).catch((error) => logger.error(`connect to mq error: ${r(error)}`));

      if (connection == null) {
        /*
        if (this._retryLimit < 1) {
          // eslint-disable-next-line unicorn/no-process-exit
          process.exit(1);
        }
*/

        setTimeout(
          () =>
            this.createConnection().catch(() => {
              // this._retryLimit -= 1;
              logger.error(`reconnect to mq error, retry in 10s.`);
            }),
          10000,
        );
        return Promise.reject();
      }

      // this._retryLimit = 10;
      this.#connectionFuture = connection as amqp.Connection;
      logger.log('connection established');
      return Promise.resolve(this.#connectionFuture);
    }

    logger.error(`mq not enabled: ${MQProvider.enabled}`);
    return Promise.reject();
  }

  static get instance(): MQProvider {
    return MQProvider._instance;
  }

  async send(topic, payload): Promise<boolean> {
    if (!this.#connectionFuture) {
      this.#connectionFuture = await this.createConnection();
    }

    if (!this.#channel) {
      this.#channel = await this.#connectionFuture.createChannel();
    }

    return this.#channel.assertQueue(topic).then((ok) => {
      logger.log(`send payload(${r(payload)}) to topic(${topic})`);
      return this.#channel.sendToQueue(topic, Buffer.from(JSON.stringify(payload)));
    });
  }

  static get enabled(): boolean {
    return MQConfigObject.load().enable;
  }

  get connectionFuture(): Promise<amqp.Connection> {
    if (this.#connectionFuture != null) {
      return Promise.resolve(this.#connectionFuture);
    }

    return this.createConnection();
  }
}
