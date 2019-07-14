import { Logger } from '@nestjs/common';
import { FastifyRequest } from 'fastify';
import * as fsExtra from 'fs-extra';
import * as os from 'os';
import * as pump from 'pump';
import { r } from '../../common/helpers';

const logger = new Logger('ReqHelper');

export class ReqHelper {
  /**
   * 将 req 中的流转储到临时目录中
   * @param req
   * @param filename
   */
  static saveFileByReq(req: FastifyRequest, filename: string): Promise<string> {
    const tempfile = `${os.tmpdir()}/${filename}`;
    const stream = fsExtra.createWriteStream(tempfile);
    req.raw.pipe(stream);

    return new Promise(resolve => {
      req.raw.on('end', () => {
        logger.log(`save to ${tempfile} done.`);
        resolve(tempfile);
      });
    });
  }

  static saveFile(fileStream: NodeJS.ReadableStream, filename: string): Promise<string> {
    const tempfile = `${os.tmpdir()}/${filename}`;
    logger.log(`save file to ${r({ filename, tempfile })}`);
    return new Promise((resolve, reject) =>
      pump(fileStream, fsExtra.createWriteStream(tempfile), err =>
        err ? reject(err) : resolve(tempfile),
      ),
    );
  }
}
