import { configLoader } from '../config';

export class CacheTTL {
  static FLASH = configLoader.loadNumericConfig('CACHE_FLASH_TTL', 60_000); // 1min
  static SHORT = configLoader.loadNumericConfig('CACHE_SHORT_TTL', 600_000); // 10min
  static MEDIUM = configLoader.loadNumericConfig('CACHE_MEDIUM_TTL', 1800_000); // 30min
  static LONG_1 = configLoader.loadNumericConfig('CACHE_LONG_TTL', 3600_000); // 60min
  static LONG_24 = configLoader.loadNumericConfig('CACHE_LONG_TTL', 24 * 3600_000); // 60min
}
