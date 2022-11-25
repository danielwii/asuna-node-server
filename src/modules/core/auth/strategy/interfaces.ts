import { getIgnoreCase } from '../../../common/helpers';

import type { AdminUser } from '../auth.entities';
import type { Request } from 'express';
import type { AnyAuthRequest, ApiKeyPayload } from '../../../helper/interfaces';

export const API_KEY_HEADER = 'X-API-KEY';

export interface ApiKeyRequest {
  isApiKeyRequest: boolean;
}

export function isApiKeyRequest(req: Request): req is AnyAuthRequest<ApiKeyPayload, AdminUser> {
  return !!getIgnoreCase(req.headers, API_KEY_HEADER);
}
