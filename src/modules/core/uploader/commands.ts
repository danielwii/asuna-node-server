import { Logger } from '@nestjs/common';
import { CommandHandler, EventPublisher, ICommandHandler } from '@nestjs/cqrs';

import { r } from '@danielwii/asuna-helper/dist/serializer';

import * as mime from 'mime-types';

import { resolveModule } from '@danielwii/asuna-helper/dist/logger/factory';
import { AsunaContext, StorageEngineMode } from '../context';
import { OperationToken } from '../token';
import { UploaderRoot } from './model';

export class UploadCommand {
  public constructor(
    public readonly token: OperationToken,
    public readonly fileInfo: any, // UploaderFileInfo,
    public readonly storageEngine: StorageEngineMode,
    public readonly opts: { bucket?: string; prefix?: string },
  ) {}
}

@CommandHandler(UploadCommand)
export class UploaderHandler implements ICommandHandler<UploadCommand> {
  private static readonly logger = new Logger(resolveModule(__filename, UploaderHandler.name));

  public constructor(private readonly publisher: EventPublisher) {}

  public async execute(command: UploadCommand): Promise<any> {
    const { fileInfo, opts } = command;
    const mimetype = mime.lookup(fileInfo.filename) || 'application/octet-stream';
    UploaderHandler.logger.log(`handle command ${r(command)} with mimetype: ${mimetype}`);
    const saved = await AsunaContext.instance.chunksStorageEngine.saveEntity({ ...fileInfo, mimetype }, opts);
    const UploaderModel = this.publisher.mergeClassContext(UploaderRoot);
    const uploader = new UploaderModel();
    // uploader.uploadChunks();
    uploader.commit();
  }
}
