import { OperationToken, OperationTokenHelper } from '../token';
import { UploaderTokenServiceName } from './model';

export class UploaderHelper {
  static createChunksUploadTask(
    identifier: any,
    key: string,
    totalChunks: number,
  ): Promise<OperationToken> {
    return OperationTokenHelper.obtainToken({
      type: 'TimeBased',
      role: 'operation',
      payload: { key, totalChunks },
      service: UploaderTokenServiceName.UploadChunks,
      identifier,
    });
  }
}
