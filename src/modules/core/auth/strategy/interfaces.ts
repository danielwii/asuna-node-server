import { Request } from 'express';
import { getIgnoreCase } from '../../../common/helpers';
import { AnyAuthRequest, ApiKeyPayload } from '../../../helper/interfaces';
import { AdminUser } from '../auth.entities';

export const API_KEY_HEADER = 'X-ApiKey';

export function isApiKeyRequest(req: Request): req is AnyAuthRequest<ApiKeyPayload, AdminUser> {
  return !!getIgnoreCase(req.headers, API_KEY_HEADER);
}
