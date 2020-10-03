import { AxiosResponse } from 'axios';
import { join } from 'path';
import { download, r } from '../modules/common/helpers';
import { LoggerFactory } from '../modules/common/logger';
import { handleAxiosResponseError } from './helper';
import { AppConfigObject } from '../modules/config/app.config';

const logger = LoggerFactory.getLogger('Downloader');

export function fetchFile(url: string, to: string): Promise<string | AxiosResponse> {
  const host = AppConfigObject.load().masterAddress;

  const fixedPath = join('/', url).replace(/^\/+/, '/');
  const endpoint = `${host}${fixedPath}?internal=1`;
  logger.log(`fetch file: ${r({ endpoint, url, to })}`);
  return download(endpoint, to).catch((error) => handleAxiosResponseError(endpoint, error));
}
