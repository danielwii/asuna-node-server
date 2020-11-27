import { AsunaErrorCode, AsunaException } from '../common/exceptions';

export function wrapErrorInfo(info: any): any {
  if (info instanceof Error) {
    return new AsunaException(AsunaErrorCode.InvalidCredentials, info.message, info);
  }
  return info;
}
