import { Injectable } from '@nestjs/common';

import { LoggerFactory } from '@danielwii/asuna-helper/dist/logger';
import { r } from '@danielwii/asuna-helper/dist/serializer';

import * as amqp from 'amqplib';
import _ from 'lodash';

import { MQConfigObject } from './mq.config';

const logger = LoggerFactory.getLogger('MQProvider');

@Injectable()
export class MQProvider {
  private static _instance: MQProvider;

  private _connectionFuture?: amqp.Connection;
  private channel?: amqp.Channel;
  private isHealthy: boolean;
  // private _retryLimit = 10;

  // eslint-disable-next-line @typescript-eslint/no-empty-function
  private constructor() {}

  private async createConnection(): Promise<amqp.Connection> {
    if (!MQProvider.enabled) {
      logger.error(`mq not enabled: ${MQProvider.enabled}`);
      return Promise.reject();
    }

    const { url } = MQConfigObject.load();
    logger.log(`connecting to ${url}`);
    await amqp
      .connect(url)
      .then((connection) => {
        this._connectionFuture = connection as amqp.Connection;
        this.isHealthy = true;
        logger.log('connection established');
      })
      .catch((error) => {
        logger.error(`connect to mq error: ${r(error)}`);

        this.isHealthy = false;
        /*
        if (this._retryLimit < 1) {
          // eslint-disable-next-line unicorn/no-process-exit
          process.exit(1);
        }
*/

        setTimeout(async () => {
          this.createConnection()
            .then((connection) => {
              this._connectionFuture = connection as amqp.Connection;
              this.isHealthy = true;
            })
            .catch(() => {
              this.isHealthy = false;
              // this._retryLimit -= 1;
              logger.error(`reconnect to mq error, retry in 10s.`);
            });
        }, 10000);
        return Promise.reject();
      });

    // this._retryLimit = 10;
    return Promise.resolve(this._connectionFuture);
  }

  static get instance(): MQProvider {
    if (_.isNil(this._instance)) {
      this._instance = new MQProvider();
    }
    return MQProvider._instance;
  }

  async send(topic, payload): Promise<boolean> {
    if (!this._connectionFuture) {
      this._connectionFuture = await this.createConnection();
    }

    if (!this.channel) {
      this.channel = await this._connectionFuture.createChannel();
    }

    return this.channel.assertQueue(topic).then((ok) => {
      logger.log(`send payload(${r(payload)}) to topic(${topic})`);
      return this.channel.sendToQueue(topic, Buffer.from(JSON.stringify(payload)));
    });
  }

  static get enabled(): boolean {
    return MQConfigObject.load().enable;
  }

  static get isHealthy(): boolean {
    return MQProvider._instance.isHealthy;
  }

  get connectionFuture(): Promise<amqp.Connection> {
    if (!_.isNil(this._connectionFuture)) {
      return Promise.resolve(this._connectionFuture);
    }

    return this.createConnection();
  }
}
