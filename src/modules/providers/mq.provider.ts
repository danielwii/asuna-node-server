import { Injectable } from '@nestjs/common';
import * as amqplib from 'amqplib';
import { r } from '../common/helpers';
import { LoggerFactory } from '../common/logger';
import { MQConfigObject } from './mq.config';

const logger = LoggerFactory.getLogger('MQProvider');

@Injectable()
export class MQProvider {
  private static _instance: MQProvider = new MQProvider();

  private _connection: amqplib.Connection;
  private _channel: amqplib.Channel;
  private _retryLimit = 10;

  private constructor() {}

  private async createConnection(): Promise<amqplib.Connection> {
    if (MQProvider.enabled) {
      const url = MQConfigObject.load().url;
      logger.log(`connecting to ${url}`);
      const connection = await amqplib
        .connect(url)
        .catch(error => logger.error(`connect to mq error: ${r(error)}`));

      if (connection == null) {
        if (this._retryLimit < 1) {
          process.exit(1);
        }

        setTimeout(
          () =>
            this.createConnection().catch(reason => {
              this._retryLimit -= 1;
              logger.error(`reconnect(${10 - this._retryLimit}) to mq error, retry in 10s.`);
            }),
          10000,
        );
        return Promise.reject();
      }

      this._retryLimit = 10;
      this._connection = connection as amqplib.Connection;
      logger.log('connection established');
      return Promise.resolve(this._connection);
    }

    logger.error(`mq not enabled: ${MQProvider.enabled}`);
    return Promise.reject();
  }

  static get instance(): MQProvider {
    return MQProvider._instance;
  }

  async send(topic, payload): Promise<boolean> {
    if (!this._connection) {
      this._connection = await this.createConnection();
    }

    if (!this._channel) {
      this._channel = await this._connection.createChannel();
    }

    return this._channel.assertQueue(topic).then(ok => {
      logger.log(`send payload(${r(payload)}) to topic(${topic})`);
      return this._channel.sendToQueue(topic, Buffer.from(JSON.stringify(payload)));
    });
  }

  static get enabled() {
    return MQConfigObject.load().enable;
  }

  get connection(): Promise<amqplib.Connection> {
    if (this._connection != null) {
      return Promise.resolve(this._connection);
    }

    return this.createConnection();
  }
}
