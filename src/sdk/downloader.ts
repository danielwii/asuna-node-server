import { join } from 'path';
import { AsunaError, AsunaException } from '../modules/common';
import { download, r } from '../modules/common/helpers';
import { ConfigKeys, configLoader } from '../modules/config';
import { LoggerFactory } from '../modules/logger';

const logger = LoggerFactory.getLogger('Downloader');

export function fetchFile(path: string, to: string): Promise<any> {
  const defaultPort = configLoader.loadConfig(ConfigKeys.PORT, 5000);
  const host = configLoader.loadConfig(
    ConfigKeys.MASTER_ADDRESS,
    `http://127.0.0.1:${defaultPort}`,
  );
  if (!host) {
    throw new AsunaException(AsunaError.Unprocessable, 'MASTER_ADDRESS is required.');
  }
  const fixedPath = join('/', path).replace(/^\/+/, '/');
  const url = `${host}${fixedPath}`;
  logger.log(`fetch file: ${r({ url, path, to })}`);
  return download(url, to).catch(reason => reason.response);
}
