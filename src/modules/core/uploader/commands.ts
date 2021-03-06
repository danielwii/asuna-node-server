import { CommandHandler, EventPublisher, ICommandHandler } from '@nestjs/cqrs';

import { LoggerFactory } from '@danielwii/asuna-helper/dist/logger';
import { r } from '@danielwii/asuna-helper/dist/serializer';

import * as mime from 'mime-types';

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
  private static readonly logger = LoggerFactory.getLogger(UploaderHandler.name);

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
