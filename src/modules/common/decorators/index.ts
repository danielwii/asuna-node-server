import { createParamDecorator } from '@nestjs/common';
import * as requestIp from 'request-ip';

export * from './meta.decorator';
export * from './user.decorator';

export declare type ClassType<T> = {
  new (...args: any[]): T;
};

export const IpAddress = createParamDecorator((data, req) => {
  // In case we forgot to include requestIp.mw() in main.ts
  return req.clientIp ? req.clientIp : requestIp.getClientIp(req);
});
