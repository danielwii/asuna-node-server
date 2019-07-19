import { Injectable } from '@nestjs/common';
import * as amqplib from 'amqplib';
import { r } from '../common/helpers';
import { LoggerFactory } from '../logger';
import { MQConfigObject } from './mq.config';

const logger = LoggerFactory.getLogger('MQProvider');

@Injectable()
export class MQProvider {
  private static _instance: MQProvider;

  private _connection: amqplib.Connection;
  private _channel: amqplib.Channel;

  private constructor() {
    if (MQProvider.enabled) {
      const url = MQConfigObject.load().url;
      logger.log(`connecting to ${url}`);
      amqplib
        .connect(url)
        .then(connection => (this._connection = connection))
        .catch(error => {
          logger.error(`connect to mq error: ${r(error)}`);
          process.exit(1);
        });
    }
  }

  static get instance(): MQProvider {
    if (MQProvider._instance == null) {
      MQProvider._instance = new MQProvider();
    }
    return MQProvider._instance;
  }

  get createChannel(): Promise<amqplib.Channel> {
    if (MQProvider.enabled && this._connection != null) {
      return this._connection.createChannel();
    }
    return Promise.reject();
  }

  async send(topic, payload): Promise<boolean> {
    if (!this._connection) {
      logger.error(`cannot connect to MQ server, ${r({ topic, payload })}`);
      return;
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

  get connection() {
    return this._connection;
  }
}
