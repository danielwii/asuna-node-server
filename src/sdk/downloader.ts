import { join } from 'path';

import { download, r } from '../modules/common/helpers/utils';
import { LoggerFactory } from '../modules/common/logger';
import { AppConfigObject } from '../modules/config/app.config';
import { handleAxiosResponseError } from './helper';

import type { AxiosResponse } from 'axios';

const logger = LoggerFactory.getLogger('Downloader');

export function fetchFile(url: string, to: string): Promise<string | AxiosResponse> {
  const host = AppConfigObject.load().masterAddress;

  let endpoint = url;
  if (!url.startsWith('http')) {
    const fixedPath = join('/', url).replace(/^\/+/, '/');
    // `${host}${fixedPath}?internal=1`
    endpoint = new URL(`${fixedPath}?internal=1`, host).href;
  }
  logger.log(`fetch file: ${r({ endpoint, url, to })}`);
  return download(endpoint, to).catch((error) => handleAxiosResponseError(endpoint, error));
}
