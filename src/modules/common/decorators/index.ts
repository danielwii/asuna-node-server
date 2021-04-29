import { createParamDecorator } from '@nestjs/common';

import { getClientIp } from 'request-ip';

export * from './meta.decorator';
export * from './user.decorator';

export const IpAddress = createParamDecorator((data, req) => {
  // In case we forgot to include requestIp.mw() in main.ts
  return req.clientIp ? req.clientIp : getClientIp(req);
});
