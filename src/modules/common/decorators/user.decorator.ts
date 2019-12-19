import { createParamDecorator } from '@nestjs/common';

export const CurrentUser = createParamDecorator((data, req) => {
  return req.user;
});

export const CurrentTenant = createParamDecorator((data, req) => {
  return req.tenant;
});
