export interface CronStatsInterface {
  latestAt: Date;
  nextAt: Date;
  message?: string;
  verbose: object;
  success: number;
  failure: number;
  events: EventStatsInterface[];
}

export interface EventStatsInterface {
  parameters: object;
  result: object;
}

export interface StatsResult<Value = any> {
  value?: Value;
  stats?: object;
}
