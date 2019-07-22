import { Injectable } from '@nestjs/common';
import * as amqplib from 'amqplib';
import { r } from '../common/helpers';
import { LoggerFactory } from '../logger';
import { MQConfigObject } from './mq.config';

const logger = LoggerFactory.getLogger('MQProvider');

@Injectable()
export class MQProvider {
  private static _instance: MQProvider = new MQProvider();

  private _connection: amqplib.Connection;
  private _channel: amqplib.Channel;

  private constructor() {}

  private createConnection(): Promise<amqplib.Connection> {
    return new Promise((resolve, reject) => {
      if (MQProvider.enabled) {
        const url = MQConfigObject.load().url;
        logger.log(`connecting to ${url}`);
        amqplib
          .connect(url)
          .then(connection => {
            logger.log('connection established');
            this._connection = connection;
            resolve(connection);
          })
          .catch(error => {
            logger.error(`connect to mq error: ${r(error)}`);
            process.exit(1);
          });
      } else {
        reject();
      }
    });
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
