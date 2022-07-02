import { Logger } from '@nestjs/common';

import { r } from '@danielwii/asuna-helper/dist/serializer';

import * as fs from 'fs-extra';
import * as os from 'os';
import pump from 'pump';

import type { Request } from 'express';

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
        Logger.log(`save to ${tempfile} done.`);
        resolve(tempfile);
      });
    });
  }

  static saveFile(fileStream: pump.Stream, filename: string): Promise<string> {
    const tempfile = `${os.tmpdir()}/${filename}`;
    Logger.log(`save file to ${r({ filename, tempfile })}`);
    return new Promise((resolve, reject) => {
      pump(fileStream, fs.createWriteStream(tempfile), (err) => (err ? reject(err) : resolve(tempfile)));
    });
  }
}
