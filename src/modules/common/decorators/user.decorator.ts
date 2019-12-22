import { createParamDecorator } from '@nestjs/common';

export const CurrentUser = createParamDecorator((data, req) => {
  return req.user;
});

export const CurrentTenant = createParamDecorator((data, req) => {
  return req.tenant;
});

export const CurrentRoles = createParamDecorator((data, req) => {
  return req.roles;
});
