import axios, { AxiosResponse } from 'axios';
import * as fs from 'fs-extra';
import * as _ from 'lodash';
import * as querystring from 'querystring';
import { r } from '../modules/common/helpers';
import { LoggerFactory } from '../modules/common/logger';
import { ConfigKeys, configLoader } from '../modules/config';
import { Hermes, InMemoryAsunaQueue } from '../modules/core/bus';
import { handleAxiosResponseError } from './helper';

const logger = LoggerFactory.getLogger('Uploader');

export class Uploader {
  private asunaQueue: InMemoryAsunaQueue;

  private queueName = 'IN_MEMORY_CHUNKED_UPLOAD';

  private static instance = new Uploader();

  private constructor() {
    this.asunaQueue = Hermes.regInMemoryQueue(this.queueName);
    Hermes.setupJobProcessor(this.queueName, payload => {
      logger.log(`queue(${this.queueName}): ${r(payload)}`);
      return payload;
    });
  }

  // TODO not implemented
  private async fileToChunks(file: File, opts: { chunkSize?: number } = {}): Promise<any> {
    // eslint-disable-next-line no-bitwise
    const chunkSize = _.get(opts, 'chunkSize', (2 * 1024) ^ 2);
    const totalChunks = Math.ceil(file.size / chunkSize);
  }

  static async upload(bucket: string, prefix: string, path: string, filename): Promise<AxiosResponse<any> | string> {
    const defaultPort = configLoader.loadConfig(ConfigKeys.PORT, 5000);
    const host = configLoader.loadConfig(ConfigKeys.MASTER_ADDRESS, `http://127.0.0.1:${defaultPort}`);
    const endpoint = `${host}/api/v1/uploader/stream`;

    const limit = configLoader.loadConfig(ConfigKeys.PAYLOAD_LIMIT, '2mb');
    const stat = await fs.stat(path);
    const maxContentLength = 1000 * 1000 * +limit.slice(0, -2);
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
      .catch(error => handleAxiosResponseError(endpoint, error));
  }

  // TODO async uploadFolder(dir: string) {}
}
