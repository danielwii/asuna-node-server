import { CanActivate, ExecutionContext, Injectable, Logger } from '@nestjs/common';

import { AsunaErrorCode, AsunaException } from '@danielwii/asuna-helper/dist/exceptions';
import { resolveModule } from '@danielwii/asuna-helper/dist/logger/factory';
import { random } from '@danielwii/asuna-helper/dist/random';
import { r } from '@danielwii/asuna-helper/dist/serializer';

import { fileURLToPath } from 'node:url';

import { CacheKey, InMemoryDB } from '../../cache';

import type { JwtAuthRequest } from '../../core/auth';

@Injectable()
export class CsurfGuard implements CanActivate {
  private readonly logger = new Logger(resolveModule(fileURLToPath(import.meta.url), this.constructor.name));
  public async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<JwtAuthRequest>();
    // const res = context.switchToHttp().getResponse<Response>();
    // const next = context.switchToHttp().getNext();

    const token =
      req.body.$csurf ??
      req.query.$csurf ??
      req.headers['csrf-token'] ??
      req.headers['xsrf-token'] ??
      req.headers['x-csrf-token'] ??
      req.headers['x-xsrf-token'];
    this.logger.log(`check url: ${req.url} - ${token}`);

    const calcKey: CacheKey = { prefix: 'csurf', key: token };
    const exists = await InMemoryDB.get(calcKey);
    this.logger.log(`csurf ${r({ exists, calcKey })}`);
    if (!exists) {
      throw new AsunaException(AsunaErrorCode.InvalidCsrfToken);
    }
    InMemoryDB.clear(calcKey).catch((reason) => this.logger.error(reason));

    return true;
  }
}

export class CsurfHelper {
  public static generate(): string {
    const token = random(30);
    const key = { prefix: 'csurf', key: token };
    Logger.log(`generate csurf ${r(key)}`);
    InMemoryDB.save(key, () => ({ token }), { expiresInSeconds: 60 * 60 }).catch((reason) => Logger.error(reason));
    return token;
  }
}
