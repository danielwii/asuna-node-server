import { Logger } from '@nestjs/common';
import { Request } from 'express';
import * as fsExtra from 'fs-extra';
import * as os from 'os';

const logger = new Logger('ReqHelper');

export class ReqHelper {
  /**
   * 将 req 中的流转储到临时目录中
   * @param req
   * @param filename
   */
  static saveFile(req: Request, filename: string): Promise<string> {
    const tempFile = `${os.tmpdir()}/${filename}`;
    const stream = fsExtra.createWriteStream(tempFile);
    req.pipe(stream);

    return new Promise(resolve => {
      req.on('end', () => {
        logger.log(`save to ${tempFile} done.`);
        resolve(tempFile);
      });
    });
  }
}
