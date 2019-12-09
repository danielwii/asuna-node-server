import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Request } from 'express';
import { from, Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { AsunaErrorCode, AsunaException, getIgnoreCase } from '../../common';
import { OperationToken } from './entities';
import { OperationTokenHelper } from './helper';

export type OperationTokenRequest = Request & { token: OperationToken };

const OPERATION_TOKEN_HEADER = 'X-OperationToken';

@Injectable()
export class OperationTokenGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean | Promise<boolean> | Observable<boolean> {
    const req: OperationTokenRequest = context.switchToHttp().getRequest();

    const token = getIgnoreCase(req.headers, OPERATION_TOKEN_HEADER);
    return from(OperationTokenHelper.getTokenByToken(token)).pipe(
      map(operationToken => {
        if (operationToken == null) {
          throw new AsunaException(AsunaErrorCode.Unprocessable, 'operation token required.');
        }
        req.token = operationToken;
        return true;
      }),
    );
  }
}
