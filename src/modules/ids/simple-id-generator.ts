import Chance from 'chance';
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

  public constructor(workerId = 0) {
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

export class SimpleIdGenerator {
  private static startEpoch = 1_546_300_800_000; // 2019/1/1
  private readonly workerId: number;

  public constructor(private readonly prefix: string = '', workerId = 0) {
    this.workerId = Math.abs(workerId) % 10;
  }

  public nextId(): string {
    return oneLineTrim`
      ${this.prefix}
      ${(Date.now() - SimpleIdGenerator.startEpoch).toString().slice(0, 7)}
      ${this.workerId}
      ${process.hrtime()[1].toString().slice(2, 6)}
    `;
  }

  public static nextId(prefix?: string, workerId?: number): string {
    return oneLineTrim`
      ${prefix}
      ${(Date.now() - SimpleIdGenerator.startEpoch).toString().slice(0, 7)}
      ${workerId || 0}
      ${process.hrtime()[1].toString().slice(2, 6)}
    `;
  }
}

export class SimpleIdGeneratorHelper {
  private static readonly chance = new Chance();

  public static registeredTypes: { [key: string]: string } = {};
  public static registeredRandomPrefixes = new Set();

  public static nextId(prefix?: string, workerId?: number): string {
    return SimpleIdGenerator.nextId(prefix, workerId);
  }

  public static nextIdByType(type: string, workerId?: number): string {
    return SimpleIdGenerator.nextId(this.registeredTypes[type], workerId);
  }

  public static randomId(prefix = '', length = 12) {
    SimpleIdGeneratorHelper.registeredRandomPrefixes.add(prefix);
    return prefix + SimpleIdGeneratorHelper.chance.string({ alpha: true, numeric: true, length });
  }
}
