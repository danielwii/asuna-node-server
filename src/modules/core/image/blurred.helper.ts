import { Logger } from '@nestjs/common';

import { encode } from 'blurhash';
import sharp from 'sharp';

export class BlurredHelper {
  public static async encodeImageToBlurhash(path: string): Promise<string> {
    Logger.log(`encodeImageToBlurhash: ${path}`);
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
