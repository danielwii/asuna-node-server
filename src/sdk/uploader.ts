import axios, { AxiosResponse } from 'axios';
import * as fs from 'fs-extra';
import * as _ from 'lodash';
import * as querystring from 'querystring';
import { r } from '../modules/common/helpers';
import { LoggerFactory } from '../modules/common/logger';
import { Hermes, InMemoryAsunaQueue } from '../modules/core/bus';
import { handleAxiosResponseError } from './helper';
import { AppConfigObject } from '../modules/config/app.config';

const logger = LoggerFactory.getLogger('Uploader');

export class Uploader {
  private asunaQueue: InMemoryAsunaQueue;

  private queueName = 'IN_MEMORY_CHUNKED_UPLOAD';

  private static instance: Uploader;
  private static appSettings: AppConfigObject;

  private constructor() {
    Uploader.appSettings = AppConfigObject.load();
    Hermes.initialize().then(() => {
      this.asunaQueue = Hermes.regInMemoryQueue(this.queueName);
      Hermes.setupJobProcessor(this.queueName, (payload) => {
        logger.log(`queue(${this.queueName}): ${r(payload)}`);
        return payload;
      });
    });
  }

  public static async init(): Promise<void> {
    if (!Uploader.instance) Uploader.instance = new Uploader();
  }

  // TODO not implemented
  private async fileToChunks(file: File, opts: { chunkSize?: number } = {}): Promise<any> {
    // eslint-disable-next-line no-bitwise
    const chunkSize = _.get(opts, 'chunkSize', (2 * 1024) ^ 2);
    const totalChunks = Math.ceil(file.size / chunkSize);
  }

  public static async upload(bucket: string, prefix: string, path: string, filename): Promise<AxiosResponse | string> {
    const host = this.appSettings.masterAddress;
    const endpoint = `${host}/api/v1/uploader/stream`;

    const limit = this.appSettings.payloadLimit;
    const stat = await fs.stat(path);
    const maxContentLength = 1000 * 1000 * Number(limit.slice(0, -2));
    logger.log(`upload: ${r({ endpoint, path, bucket, prefix, filename, stat, maxContentLength })}`);

    if (stat.size > maxContentLength) {
      throw new Error(`file size is ${stat.size} large than maxContentLength ${maxContentLength}`);
    }

    const readable = fs.createReadStream(path);

    return axios
      .post(`${endpoint}?${querystring.stringify({ bucket, prefix, filename })}`, readable, {
        headers: { 'content-type': 'multipart/form-data' },
        maxContentLength,
      })
      .catch((error) => handleAxiosResponseError(endpoint, error));
  }

  // TODO async uploadFolder(dir: string) {}
}
