import { Injectable, Logger } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import * as bluebird from 'bluebird';
import * as fsExtra from 'fs-extra';
import * as highland from 'highland';
import * as _ from 'lodash';
import { join } from 'path';
import { AsunaError, AsunaException } from '../../common';
import { r, sha1 } from '../../common/helpers';
import { Hermes } from '../bus';
import { ConfigKeys, configLoader } from '../config.helper';
import { AsunaContext } from '../context';
import { FileInfo, SavedFile } from '../storage';
import { OperationToken } from '../token';
import { ChunksUploadPayload } from './helper';
import { UploaderRoot } from './model';

const logger = new Logger('UploaderService');

export class ChunkFileInfo {
  public readonly chunkname: string;
  public readonly file: FileInfo;
  public readonly identifier: any;
  public readonly fingerprint: string;
  public readonly chunk: number;

  constructor(o: ChunkFileInfo) {
    Object.assign(this, o);
  }
}

export class RemoteFileInfo extends FileInfo {
  public readonly fullpath: string;
  public readonly bucket: string;
  public readonly prefix: string;

  constructor(o: RemoteFileInfo) {
    super(o);
    Object.assign(this, o);
  }
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
  ): Promise<RemoteFileInfo> {
    const file = new FileInfo({ filename, path });
    const fingerprint = sha1({ identifier: token.identifier, filename });
    const chunkname = `${filename}.${chunk}`;
    const chunkFileInfo = new ChunkFileInfo({
      chunkname,
      file,
      identifier: token.identifier,
      fingerprint,
      chunk,
    });
    logger.log(`upload chunk file ${r(chunkFileInfo)}`);

    return this.context.chunkStorageEngine
      .saveEntity({ ...file, filename: chunkname }, { prefix: fingerprint })
      .then(saved => {
        const payload = token.body as Partial<ChunksUploadPayload>;
        payload.finished[chunk] = 1;
        token.save().catch(reason => logger.warn(r(reason)));
        return new RemoteFileInfo(saved);
      });
    /*
    return this.commandBus.execute(
      new UploadCommand(token, new UploadChunksData(filename, path), 'chunks', opts),
    );*/
  }

  async mergeChunks(token: OperationToken): Promise<RemoteFileInfo> {
    const payload = token.body as Partial<ChunksUploadPayload>;
    if (_.sum(payload.finished) !== payload.totalChunks) {
      throw new AsunaException(
        AsunaError.Unprocessable,
        `chunks not full uploaded. ${payload.finished.join('')}`,
      );
    }
    logger.log(`merge file '${payload.filename}' chunks... ${r(payload)}`);

    const chunks = await this.context.chunkStorageEngine.listEntities({
      prefix: payload.fingerprint,
    });
    logger.log(`found chunks: ${r(chunks)}`);

    if (!(chunks && chunks.length)) {
      throw new AsunaException(
        AsunaError.Unprocessable,
        `no chunks found for ${payload.filename} with fingerprint: ${payload.fingerprint}`,
      );
    }

    // try to merge all chunks
    logger.log(`try to merge chunks: ${r(chunks)}`);
    const filepaths = await bluebird.all(
      chunks.map(chunk =>
        this.context.chunkStorageEngine.getEntity(chunk, AsunaContext.instance.tempPath),
      ),
    );
    const tempDirectory = join(AsunaContext.instance.tempPath, 'chunks', payload.fingerprint);
    fsExtra.mkdirsSync(tempDirectory);
    const dest = join(tempDirectory, payload.filename);
    logger.log(`merge files: ${r(filepaths)} to ${dest}`);
    const writableStream = fsExtra.createWriteStream(dest);

    highland(filepaths)
      .map(fsExtra.createReadStream)
      .flatMap(highland)
      .pipe(writableStream);

    await new Promise(resolve => {
      writableStream.on('close', () => {
        logger.log(`merge file done: ${dest}, clean chunks ...`);
        resolve();
        filepaths.forEach(filepath => {
          logger.log(`remove ${filepath} ...`);
          fsExtra
            .remove(filepath)
            .catch(reason => logger.warn(`remove ${filepath} error: ${r(reason)}`));
        });
      });
    });

    const fileInfo = new FileInfo({ filename: payload.filename, path: dest });
    // const mimetype = mime.lookup(filename) || 'application/octet-stream';
    const saved = await this.context.fileStorageEngine.saveEntity(fileInfo, {
      prefix: payload.fingerprint,
    });

    return new RemoteFileInfo(saved);
  }
}
