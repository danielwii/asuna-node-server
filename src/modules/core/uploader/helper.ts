import { Logger } from '@nestjs/common';

import { r } from '@danielwii/asuna-helper/dist/serializer';

import { plainToInstance, Transform } from 'class-transformer';
import { IsInt, IsString, Min } from 'class-validator';
import { addMonths } from 'date-fns';
import _ from 'lodash';

import { sha1 } from '../../common/helpers';
import { resolveModule } from '@danielwii/asuna-helper/dist/logger/factory';
import { OperationToken, OperationTokenHelper } from '../token';
import { UploaderTokenServiceName } from './model';

const logger = new Logger(resolveModule(__filename, 'UploaderHelper'));

export class ChunksUploadPayload {
  @IsString()
  @Transform(({ value }) => _.trim(value))
  filename: string;

  @IsString()
  @Transform(({ value }) => _.trim(value))
  fingerprint: string;

  finished?: number[];

  @IsInt()
  @Min(1)
  @Transform(({ value }) => Number(value))
  totalChunks: number;

  constructor(o: ChunksUploadPayload) {
    if (!o) return;

    Object.assign(this, plainToInstance(ChunksUploadPayload, o, { enableImplicitConversion: true }), {
      finished: o.finished || new Array(o.totalChunks).fill(0),
    });
  }
}

export class CreateChunksUploadTaskOpts {
  @IsString()
  @Transform(({ value }) => _.trim(value))
  readonly identifier: string;

  @IsString()
  @Transform(({ value }) => _.trim(value))
  readonly key: string;

  @IsString()
  @Transform(({ value }) => _.trim(value))
  readonly filename: string;

  @IsInt()
  @Min(1)
  @Transform(({ value }) => Number(value))
  readonly totalChunks: number;
}

export class UploaderHelper {
  static calcFingerprint(identifier: string, filename: string) {
    const fingerprint = sha1({ identifier, filename });
    logger.debug(`calc fingerprint ${r({ identifier, filename, fingerprint })}`);
    return fingerprint;
  }

  static createChunksUploadTask({
    identifier,
    key,
    filename,
    totalChunks,
  }: CreateChunksUploadTaskOpts): Promise<OperationToken> {
    const fingerprint = this.calcFingerprint(identifier, filename);
    const payload = new ChunksUploadPayload({ filename, fingerprint, totalChunks });
    logger.log(`ChunksUploadPayload is ${r(payload)}`);
    return OperationTokenHelper.obtainToken({
      key,
      type: 'TimeBased',
      role: 'operation',
      payload,
      service: UploaderTokenServiceName.UploadChunks,
      identifier,
      expiredAt: addMonths(new Date(), 1),
    });
  }
}
