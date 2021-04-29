import { AggregateRoot } from '@nestjs/cqrs';

import { OperationToken } from '../token';

export class ChunksUploadEvent {
  constructor(public readonly token: OperationToken, public readonly chunk: ChunkInfo) {}
}

export class ChunksUploadedEvent {
  constructor(public readonly token: OperationToken, public readonly key: string) {}
}

export class ChunkInfo {
  constructor(
    public readonly index: number,
    public readonly fileInfo: any, // UploaderFileInfo,
    public readonly opts: { bucket?: string; prefix?: string },
  ) {}
}

export const UploaderTokenServiceName = {
  UploadChunks: 'uploader#chunks',
};

export class UploaderRoot extends AggregateRoot {
  /*
  constructor() {
    super();
  }
*/

  uploadChunks(token: OperationToken, chunk: ChunkInfo) {
    this.apply(new ChunksUploadEvent(token, chunk));
  }

  mergeChunks(token: OperationToken, key: string) {
    this.apply(new ChunksUploadedEvent(token, key));
  }
}
