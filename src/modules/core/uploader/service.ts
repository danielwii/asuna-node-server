import { Injectable } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import * as bluebird from 'bluebird';
import { plainToClass, Transform } from 'class-transformer';
import { IsNumber, IsString } from 'class-validator';
import * as fsExtra from 'fs-extra';
import * as highland from 'highland';
import * as _ from 'lodash';
import { join } from 'path';
import { AsunaError, AsunaException } from '../../common';
import { r } from '../../common/helpers';
import { LoggerFactory } from '../../logger';
import { Hermes } from '../bus';
import { AsunaContext } from '../context';
import { FileInfo } from '../storage';
import { OperationToken } from '../token';
import { ChunksUploadPayload, UploaderHelper } from './helper';
import { UploaderRoot } from './model';

const logger = LoggerFactory.getLogger('UploaderService');

export class ChunkFileInfo {
  @IsString()
  @Transform(value => _.trim(value))
  readonly chunkname: string;
  readonly file: FileInfo;

  @IsString()
  @Transform(value => _.trim(value))
  readonly identifier: string;

  @IsString()
  @Transform(value => _.trim(value))
  readonly fingerprint: string;

  @IsNumber()
  readonly chunk: number;

  constructor(o: ChunkFileInfo) {
    Object.assign(this, plainToClass(ChunkFileInfo, o, { enableImplicitConversion: true }));
  }
}

export class RemoteFileInfo extends FileInfo {
  @IsString()
  @Transform(value => _.trim(value))
  readonly fullpath: string;

  @IsString()
  @Transform(value => _.trim(value))
  readonly bucket: string;

  @IsString()
  @Transform(value => _.trim(value))
  readonly prefix: string;

  constructor(o: RemoteFileInfo) {
    super(o);
    Object.assign(this, plainToClass(RemoteFileInfo, o, { enableImplicitConversion: true }));
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
    const fingerprint = UploaderHelper.calcFingerprint(token.identifier, filename);
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
        const payload = new ChunksUploadPayload(token.body);
        payload.finished[chunk] = 1;
        token.save().catch(reason => logger.warn(r(reason)));
        return new RemoteFileInfo(saved);
      });
    /*
    return this.commandBus.execute(
      new UploadCommand(token, new UploadChunksData(filename, path), 'chunks', opts),
    );*/
  }

  async mergeChunks(token: OperationToken, filename?: string): Promise<RemoteFileInfo> {
    const payload = new ChunksUploadPayload(token.body);
    logger.log(
      r({
        sum: _.sum(payload.finished),
        total: payload.totalChunks,
        equals: _.sum(payload.finished) === payload.totalChunks,
      }),
    );
    if (_.sum(payload.finished) !== payload.totalChunks) {
      throw new AsunaException(
        AsunaError.Unprocessable,
        `chunks not full uploaded. ${_.sum(payload.finished)}/${payload.totalChunks}`,
      );
    }
    const _filename = filename || payload.filename;
    logger.log(`merge file '${_filename}' chunks... ${r(payload)}`);

    const chunks = await this.context.chunkStorageEngine.listEntities({
      prefix: payload.fingerprint,
    });
    logger.verbose(`found ${r(chunks.length)} chunks`);

    if (!(chunks && chunks.length)) {
      throw new AsunaException(
        AsunaError.Unprocessable,
        `no chunks found for ${_filename} with fingerprint: ${payload.fingerprint}`,
      );
    }

    // try to merge all chunks
    logger.debug(`try to merge chunks: ${r(chunks)}`);
    const filepaths = _.sortBy(
      await bluebird.all(
        chunks.map(chunk =>
          this.context.chunkStorageEngine.getEntity(chunk, AsunaContext.instance.tempPath),
        ),
      ),
      filename => +filename.slice(filename.lastIndexOf('.') + 1),
    );
    const tempDirectory = join(AsunaContext.instance.tempPath, 'chunks', payload.fingerprint);
    fsExtra.mkdirsSync(tempDirectory);
    const dest = join(tempDirectory, _filename);
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

    const fileInfo = new FileInfo({ filename: _filename, path: dest });
    // const mimetype = mime.lookup(filename) || 'application/octet-stream';
    const saved = await this.context.fileStorageEngine.saveEntity(fileInfo, {
      prefix: payload.fingerprint,
    });

    return new RemoteFileInfo(saved);
  }
}
