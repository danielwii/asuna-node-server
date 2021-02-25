import type { IAsunaContextOpts } from './modules';

export interface BootstrapOptions {
  // server folder
  // root?: string;
  // package folder
  // dirname?: string;
  loadDefaultModule?: boolean;
  staticAssets?: string;
  viewsDir?: string;
  viewEngine?: string;
  typeormEntities?: string[];
  /**
   * io     - socket.io
   * redis  - 基于 redis 共享 websocket 信息
   * ws     - websocket
   */
  redisMode?: 'io' | 'redis' | 'ws';
  context?: IAsunaContextOpts;
  renamer?: { from: string; to: string }[];
  migrations?: any[];
}
