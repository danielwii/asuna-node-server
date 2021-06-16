import { LoggerFactory } from '@danielwii/asuna-helper/dist/logger/factory';

import { encode } from 'blurhash';
import sharp from 'sharp';

const logger = LoggerFactory.getLogger('BlurredHelper');

export class BlurredHelper {
  public static async encodeImageToBlurhash(path: string): Promise<string> {
    logger.log(`encodeImageToBlurhash: ${path}`);
    return new Promise((resolve, reject) => {
      sharp(path)
        .raw()
        .ensureAlpha()
        .resize(32, 32, { fit: 'inside' })
        .toBuffer((err, buffer, { width, height }) => {
          if (err) return reject(err);
          resolve(encode(new Uint8ClampedArray(buffer), width, height, 4, 4));
        });
    });
  }
}
