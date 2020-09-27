import { LoggerFactory } from '../logger';
import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Promise } from 'bluebird';
import { JwtAuthRequest } from '../../core/auth';
import { CacheKey, InMemoryDB } from '../../cache';
import { r } from '../helpers';
import { AsunaErrorCode, AsunaException } from '../exceptions';
import { random } from '../../core/helpers';

const logger = LoggerFactory.getLogger('CsurfGuard');

@Injectable()
export class CsurfGuard implements CanActivate {
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
    logger.log(`check url: ${req.url} - ${token}`);

    const calcKey: CacheKey = { prefix: 'csurf', key: token };
    const exists = await InMemoryDB.get(calcKey);
    logger.log(`csurf ${r({ exists, calcKey })}`);
    if (!exists) {
      throw new AsunaException(AsunaErrorCode.InvalidCsrfToken);
    }
    InMemoryDB.clear(calcKey).catch((reason) => logger.error(reason));

    return true;
  }
}

export class CsurfHelper {
  public static generate(): string {
    const token = random(30);
    const key = { prefix: 'csurf', key: token };
    logger.log(`generate csurf ${r(key)}`);
    InMemoryDB.save(key, () => ({ token }), { expiresInSeconds: 60 * 60 }).catch((reason) => logger.error(reason));
    return token;
  }
}
