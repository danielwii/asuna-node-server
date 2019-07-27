import { join } from 'path';
import { download, r } from '../modules/common/helpers';
import { LoggerFactory } from '../modules/common/logger';
import { ConfigKeys, configLoader } from '../modules/config';
import { handleAxiosResponseError } from './helper';

const logger = LoggerFactory.getLogger('Downloader');

export function fetchFile(url: string, to: string): Promise<any> {
  const defaultPort = configLoader.loadConfig(ConfigKeys.PORT, 5000);
  const host = configLoader.loadConfig(
    ConfigKeys.MASTER_ADDRESS,
    `http://127.0.0.1:${defaultPort}`,
  );

  const fixedPath = join('/', url).replace(/^\/+/, '/');
  const endpoint = `${host}${fixedPath}`;
  logger.log(`fetch file: ${r({ endpoint, url, to })}`);
  return download(endpoint, to).catch(reason => handleAxiosResponseError(endpoint, reason));
}
