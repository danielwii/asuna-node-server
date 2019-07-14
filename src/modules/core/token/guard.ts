import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Request } from 'express';
import { from, Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { AsunaError, AsunaException } from '../../common';
import { OperationToken } from './entities';
import { OperationTokenHelper } from './helper';

export type OperationTokenRequest = Request & { token: OperationToken };

@Injectable()
export class OperationTokenGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean | Promise<boolean> | Observable<boolean> {
    const req: OperationTokenRequest = context.switchToHttp().getRequest();

    const token = req.headers['X-OperationToken'] as string;
    return from(OperationTokenHelper.redeemTokenByToken(token)).pipe(
      map(operationToken => {
        if (operationToken == null) {
          throw new AsunaException(AsunaError.InsufficientPermissions, 'operation token required.');
        }
        req.token = operationToken;
        return true;
      }),
    );
  }
}
