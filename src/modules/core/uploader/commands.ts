import { Logger } from '@nestjs/common';
import { CommandHandler, EventPublisher, ICommandHandler } from '@nestjs/cqrs';
import * as mime from 'mime-types';
import { r } from '../../common/helpers';
import { AsunaContext, StorageEngineMode } from '../context';
import { OperationToken } from '../token';
import { UploaderRoot } from './model';
// import { UploaderFileInfo } from './service';

export class UploadCommand {
  constructor(
    public readonly token: OperationToken,
    public readonly fileInfo: any, // UploaderFileInfo,
    public readonly storageEngine: StorageEngineMode,
    public readonly opts: { bucket?: string; prefix?: string },
  ) {}
}

@CommandHandler(UploadCommand)
export class UploaderHandler implements ICommandHandler<UploadCommand> {
  private static readonly logger = new Logger(UploaderHandler.name);

  constructor(private readonly publisher: EventPublisher) {}

  async execute(command: UploadCommand): Promise<any> {
    const { fileInfo, opts } = command;
    const mimetype = mime.lookup(fileInfo.filename) || 'application/octet-stream';
    UploaderHandler.logger.log(`handle command ${r(command)} with mimetype: ${mimetype}`);
    const saved = await AsunaContext.instance.chunkStorageEngine.saveEntity(
      { ...fileInfo, mimetype },
      opts,
    );
    const UploaderModel = this.publisher.mergeClassContext(UploaderRoot);
    const uploader = new UploaderModel();
    // uploader.uploadChunks();
    uploader.commit();
  }
}
