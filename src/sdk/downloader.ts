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
  return download(url, to).catch(reason => {
    if (reason.response) {
      // The request was made and the server responded with a status code
      // that falls out of the range of 2xx
      logger.error(
        `Error response for request ${url}: ${r({
          // data: reason.response.data,
          status: reason.response.status,
          headers: reason.response.headers,
        })}`,
      );
    } else if (reason.request) {
      // The request was made but no response was received
      // `reason.request` is an instance of XMLHttpRequest in the browser and an instance of
      // http.ClientRequest in node.js
      logger.error(`No response for request ${url}: ${r(reason.message)}`);
    } else {
      // Something happened in setting up the request that triggered an Error
      logger.error(`Error for request ${url} ${reason.message}`);
    }
    logger.error(`Download file error: ${r(reason.config)}`);
    throw reason.message;
  });
}
