import { Injectable } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { Promise } from 'bluebird';
import { plainToClass, Transform } from 'class-transformer';
import { IsInt, IsString } from 'class-validator';
import * as fs from 'fs-extra';
import highland from 'highland';
import * as _ from 'lodash';
import * as path from 'path';
import { join } from 'path';
import { AsunaErrorCode, AsunaException } from '../../common';
import { r } from '../../common/helpers';
import { LoggerFactory } from '../../common/logger';
import { Hermes } from '../bus';
import { AsunaContext } from '../context';
import { Global } from '../global';
import { FileInfo } from '../storage';
import { OperationToken } from '../token';
import { ChunksUploadPayload, UploaderHelper } from './helper';

const logger = LoggerFactory.getLogger('UploaderService');

export class ChunkFileInfo {
  @IsString()
  @Transform((value) => _.trim(value))
  readonly chunkname: string;

  readonly file: FileInfo;

  @IsString()
  @Transform((value) => _.trim(value))
  readonly identifier: string;

  @IsString()
  @Transform((value) => _.trim(value))
  readonly fingerprint: string;

  @IsInt()
  readonly chunk: number;

  constructor(o: ChunkFileInfo) {
    Object.assign(this, plainToClass(ChunkFileInfo, o, { enableImplicitConversion: true }));
  }
}

export class RemoteFileInfo extends FileInfo {
  @IsString()
  @Transform((value) => _.trim(value))
  readonly fullpath: string;

  @IsString()
  @Transform((value) => _.trim(value))
  readonly bucket: string;

  @IsString()
  @Transform((value) => _.trim(value))
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
    Hermes.subscribe(this.constructor.name, /^commands$/, (event) => {
      logger.log(r(event));
    });
  }

  uploadChunks(token: OperationToken, filename: string, chunkPath: string, chunk: number): Promise<RemoteFileInfo> {
    const file = new FileInfo({ filename, path: chunkPath });
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

    return this.context.chunksStorageEngine
      .saveEntity({ ...file, filename: chunkname }, { prefix: fingerprint })
      .then(async (saved) => {
        const payload = new ChunksUploadPayload(token.body);
        payload.finished[chunk] = 1;
        await token.save();
        return new RemoteFileInfo(saved);
      });
    /*
    return this.commandBus.execute(
      new UploadCommand(token, new UploadChunksData(filename, path), 'chunks', opts),
    ); */
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
        AsunaErrorCode.Unprocessable,
        `chunks not fully uploaded. ${_.sum(payload.finished)}/${payload.totalChunks}`,
      );
    }
    const _filename = filename || payload.filename;
    logger.log(`merge file '${_filename}' chunks... ${r(payload)}`);

    // TODO bucket 在 localStorage 中需要主动传递
    logger.debug(`chunks storage engine type is ${this.context.chunksStorageEngine.constructor.name}`);
    const chunks = await this.context.chunksStorageEngine.listEntities({
      prefix: payload.fingerprint,
      bucket: this.context.chunksStorageEngine.constructor.name === 'LocalStorage' ? 'chunks' : null,
    });
    logger.debug(`found ${r(chunks.length)} chunks`);

    if (chunks.length <= 0) {
      throw new AsunaException(
        AsunaErrorCode.Unprocessable,
        `no chunks found for ${_filename} with fingerprint: ${payload.fingerprint}`,
      );
    }

    // try to merge all chunks
    logger.verbose(`try to merge chunks: ${r(chunks)}`);
    const filepaths = _.sortBy(
      await Promise.all(chunks.map((chunk) => this.context.chunksStorageEngine.getEntity(chunk, Global.tempPath))),
      (name) => +name.slice(name.lastIndexOf('.') + 1),
    );
    const tempDirectory = join(Global.tempPath, 'chunks', payload.fingerprint);

    logger.log(`create temp folder: ${tempDirectory}`);
    fs.mkdirpSync(tempDirectory);
    const dest = join(tempDirectory, _filename);
    logger.log(`merge files: ${r(filepaths)} to ${dest}`);
    const writableStream = fs.createWriteStream(dest);

    highland(filepaths).map(fs.createReadStream).flatMap(highland).pipe(writableStream);

    await new Promise((resolve) => {
      writableStream.on('close', () => {
        const directory = path.dirname(filepaths[0]);
        logger.log(`merge file done: ${dest}, clean chunks in ${directory} ...`);
        resolve();
        // fs.remove(directory).catch(error => logger.warn(`remove ${directory} error: ${r(error)}`));
      });
    }).catch((reason) => logger.error(reason));

    const fileInfo = new FileInfo({ filename: _filename, path: dest });
    // const mimetype = mime.lookup(filename) || 'application/octet-stream';
    const storageEngine = AsunaContext.instance.getStorageEngine('files');
    const saved = await storageEngine.saveEntity(fileInfo, { prefix: payload.fingerprint });

    return new RemoteFileInfo(saved);
  }
}
