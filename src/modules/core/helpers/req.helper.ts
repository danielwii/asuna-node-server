import { Request } from 'express';
import * as fs from 'fs-extra';
import * as os from 'os';
import pump from 'pump';
import { r } from '../../common/helpers';
import { LoggerFactory } from '../../common/logger';

const logger = LoggerFactory.getLogger('ReqHelper');

export class ReqHelper {
  /**
   * 将 req 中的流转储到临时目录中
   * @param req
   * @param filename
   */
  static saveFileByReq(req: Request, filename: string): Promise<string> {
    const tempfile = `${os.tmpdir()}/${filename}`;
    const stream = fs.createWriteStream(tempfile);
    req.pipe(stream);

    return new Promise((resolve) => {
      req.on('end', () => {
        logger.log(`save to ${tempfile} done.`);
        resolve(tempfile);
      });
    });
  }

  static saveFile(fileStream: NodeJS.ReadableStream, filename: string): Promise<string> {
    const tempfile = `${os.tmpdir()}/${filename}`;
    logger.log(`save file to ${r({ filename, tempfile })}`);
    return new Promise((resolve, reject) =>
      pump(fileStream, fs.createWriteStream(tempfile), (err) => (err ? reject(err) : resolve(tempfile))),
    );
  }
}
