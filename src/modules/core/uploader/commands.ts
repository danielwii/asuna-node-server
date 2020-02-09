import { CommandHandler, EventPublisher, ICommandHandler } from '@nestjs/cqrs';
import * as mime from 'mime-types';
import { r } from '../../common/helpers';
import { LoggerFactory } from '../../common/logger';
import { AsunaContext, StorageEngineMode } from '../context';
import { OperationToken } from '../token';
import { UploaderRoot } from './model';

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
  private static readonly logger = LoggerFactory.getLogger(UploaderHandler.name);

  constructor(private readonly publisher: EventPublisher) {}

  async execute(command: UploadCommand): Promise<any> {
    const { fileInfo, opts } = command;
    const mimetype = mime.lookup(fileInfo.filename) || 'application/octet-stream';
    UploaderHandler.logger.log(`handle command ${r(command)} with mimetype: ${mimetype}`);
    const saved = await AsunaContext.instance.chunksStorageEngine.saveEntity(
      { ...fileInfo, mimetype },
      opts,
    );
    const UploaderModel = this.publisher.mergeClassContext(UploaderRoot);
    const uploader = new UploaderModel();
    // uploader.uploadChunks();
    uploader.commit();
  }
}
