// eslint-disable-next-line eslint-comments/disable-enable-pair
/* eslint-disable no-bitwise,no-underscore-dangle */
import { oneLineTrim } from 'common-tags';

/**
 * ?????????????????? - 0000     - 000000
 * n:timestamp offset - 4:worker - 6:serial
 * m bits - n bits
 * m:pool - n:timestamp offset
 */
export class SimpleDistributedIdGenerator {
  private static startEpoch = 1_546_300_800_000; // 2019/1/1
  // private static startEpoch = 1_514_764_800_000; // 2018/1/1
  private _lastStamp = -1;
  private _sequence = 0;
  private readonly _workerId: number;
  private readonly workerBits: number = 4;
  private readonly sequenceBits: number = 6;
  private readonly sequenceMask: number = ~(-1 << this.sequenceBits);
  private readonly workerShift: number = this.sequenceBits;
  private readonly timestampShift: number = this.workerBits + this.workerShift;

  constructor(workerId: number = 0) {
    if (workerId < 0 || workerId > ~(-1 << this.workerBits)) {
      throw new Error(`worker id must in [0, ${~(-1 << this.workerBits)}]`);
    }
    this._workerId = workerId;
  }

  public nextId(): number {
    let now = SimpleDistributedIdGenerator.currentTimestamp();
    this._sequence = (this._sequence + 1) & this.sequenceMask;
    if (this._lastStamp === now) {
      // 当前时间点序列溢出，则阻塞到下个时间点
      if (this._sequence === 0) now = SimpleDistributedIdGenerator.tilNextMillis(now);
    }

    this._lastStamp = now;
    const fromStart = this._lastStamp - SimpleDistributedIdGenerator.startEpoch;
    return ((fromStart << this.timestampShift) | (this._workerId << this.workerShift) | this._sequence) >>> 0;
  }

  private static currentTimestamp(): number {
    return Date.now();
  }

  private static tilNextMillis(lastStamp: number): number {
    let now = SimpleDistributedIdGenerator.currentTimestamp();
    while (now <= lastStamp) {
      now = SimpleDistributedIdGenerator.currentTimestamp();
    }
    return now;
  }
}

export class SimpleIdGeneratorHelper {
  static registeredTypes: { [key: string]: string } = {};

  static nextId(prefix?: string, workerId?: number): string {
    return SimpleIdGenerator.nextId(prefix, workerId);
  }

  static nextIdByType(type: string, workerId?: number): string {
    return SimpleIdGenerator.nextId(this.registeredTypes[type], workerId);
  }
}

export class SimpleIdGenerator {
  private static startEpoch = 1_546_300_800_000; // 2019/1/1
  private readonly workerId: number;

  constructor(private readonly prefix: string = '', workerId: number = 0) {
    this.workerId = Math.abs(workerId) % 10;
  }

  nextId(): string {
    return oneLineTrim`
      ${this.prefix}
      ${(Date.now() - SimpleIdGenerator.startEpoch).toString().slice(0, 6)}
      ${this.workerId}
      ${process
        .hrtime()[1]
        .toString()
        .slice(2, 6)}
    `;
  }

  static nextId(prefix?: string, workerId?: number): string {
    return oneLineTrim`
      ${prefix}
      ${(Date.now() - SimpleIdGenerator.startEpoch).toString().slice(0, 6)}
      ${workerId || 0}
      ${process
        .hrtime()[1]
        .toString()
        .slice(2, 6)}
    `;
  }
}
