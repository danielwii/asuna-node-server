import { r } from '../modules/common/helpers';
import { LoggerFactory } from '../modules/common/logger';

const logger = LoggerFactory.getLogger('Helper');

export function handleAxiosResponseError(endpoint: string, reason: any): void {
  if (reason.response) {
    // The request was made and the server responded with a status code
    // that falls out of the range of 2xx
    logger.error(
      `Error response for request ${endpoint}: ${r({
        // data: reason.response.data,
        status: reason.response.status,
        headers: reason.response.headers,
      })}`,
    );
  } else if (reason.request) {
    // The request was made but no response was received
    // `reason.request` is an instance of XMLHttpRequest in the browser and an instance of
    // http.ClientRequest in node.js
    logger.error(`No response for request ${endpoint}: ${r(reason.message)}`);
  } else {
    // Something happened in setting up the request that triggered an Error
    logger.error(`Error for request ${endpoint} ${reason.message}`);
  }
  logger.error(`request error: ${r(reason.config)}`);
  throw reason.message;
}
