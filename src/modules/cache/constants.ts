import { configLoader } from '../config/loader';

export class CacheTTL {
  public static FLASH = configLoader.loadNumericConfig('CACHE_FLASH_TTL', 60_000); // 1min
  public static SHORT = configLoader.loadNumericConfig('CACHE_SHORT_TTL', 600_000); // 10min
  public static MEDIUM = configLoader.loadNumericConfig('CACHE_MEDIUM_TTL', 1800_000); // 30min
  public static LONG_1 = configLoader.loadNumericConfig('CACHE_LONG_1_TTL', 3600_000); // 60min
  public static LONG_24 = configLoader.loadNumericConfig('CACHE_LONG_24_TTL', 24 * 3600_000); // 24hour
  public static WEEK = configLoader.loadNumericConfig('CACHE_WEEK_TTL', 7 * 24 * 3600_000); // 1week
}
