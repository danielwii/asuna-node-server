import { sha1 } from '../../common/helpers';
import { OperationToken, OperationTokenHelper } from '../token';
import { UploaderTokenServiceName } from './model';

export class ChunksUploadPayload {
  filename: string;
  fingerprint: string;
  totalChunks: number;
  finished: number[];

  constructor(o: Omit<ChunksUploadPayload, 'finished'>) {
    Object.assign(this, o, {
      finished: Array(o.totalChunks).fill(0),
    });
  }
}

export class UploaderHelper {
  static createChunksUploadTask(
    identifier: any,
    filename: string,
    totalChunks: number,
  ): Promise<OperationToken> {
    const fingerprint = sha1({ identifier, filename });
    return OperationTokenHelper.obtainToken({
      type: 'TimeBased',
      role: 'operation',
      payload: new ChunksUploadPayload({ filename, fingerprint, totalChunks }),
      service: UploaderTokenServiceName.UploadChunks,
      identifier,
    });
  }
}
