/**
 * ?????????????????? - 0000     - 000000
 * n:timestamp offset - 4:worker - 6:serial
 * m bits - n bits
 * m:pool - n:timestamp offset
 */
export class SimpleIdGenerator {
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

  constructor(workerId: number) {
    if (workerId < 0 || workerId > ~(-1 << this.workerBits)) {
      new Error(`worker id must in [0, ${~(-1 << this.workerBits)}]`);
    }
    this._workerId = workerId;
  }

  public nextId(): number {
    let now = SimpleIdGenerator.currentTimestamp();
    this._sequence = (this._sequence + 1) & this.sequenceMask;
    if (this._lastStamp == now) {
      // 当前时间点序列溢出，则阻塞到下个时间点
      if (this._sequence == 0) now = SimpleIdGenerator.tilNextMillis(now);
    }

    this._lastStamp = now;
    const fromStart = this._lastStamp - SimpleIdGenerator.startEpoch;
    return (
      ((fromStart << this.timestampShift) |
        (this._workerId << this.workerShift) |
        this._sequence) >>>
      0
    );
  }

  private static currentTimestamp(): number {
    return Date.now();
  }

  private static tilNextMillis(lastStamp: number): number {
    let now = SimpleIdGenerator.currentTimestamp();
    while (now <= lastStamp) {
      now = SimpleIdGenerator.currentTimestamp();
    }
    return now;
  }
}
