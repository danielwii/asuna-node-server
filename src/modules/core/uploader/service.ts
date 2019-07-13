import { Injectable, Logger } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { r, sha1 } from '../../common/helpers';
import { Hermes } from '../bus';
import { AsunaContext } from '../context';
import { SavedFile } from '../storage';
import { OperationToken } from '../token';
import { UploaderRoot } from './model';

const logger = new Logger('UploaderService');

export class UploadChunksData {
  constructor(public readonly filename: string, public readonly path: string) {}
}

@Injectable()
export class UploaderService {
  private readonly context = AsunaContext.instance;

  constructor(private readonly commandBus: CommandBus) {
    Hermes.subscribe(UploaderRoot.name, /^commands$/, event => {
      logger.log(r(event));
    });
  }

  uploadChunks(
    token: OperationToken,
    filename: string,
    path: string,
    chunk: number,
  ): Promise<SavedFile> {
    const file = { filename, path, mimetype: 'application/octet-stream' /* default */ };

    const fingerprint = sha1({ identifier: token.identifier, filename });
    const chunkname = `${file.filename}.${chunk}`;
    logger.log(
      `upload chunk file ${r({
        filename,
        chunkname,
        file,
        identifier: token.identifier,
        fingerprint,
        chunk,
      })}`,
    );

    file.filename = chunkname;
    return this.context.chunkStorageEngine.saveEntity(file, { prefix: fingerprint });
    // return this.commandBus.execute(
    //   new UploadCommand(token, new UploadChunksData(filename, path), 'chunks', opts),
    // );
  }
}
