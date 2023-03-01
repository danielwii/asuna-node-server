import { getIgnoreCase } from '../../../common/helpers';

import type { Request } from 'express';
import type { AnyAuthRequest, ApiKeyPayload } from '../../../helper/interfaces';
import type { AdminApiKey, AdminUser } from '../auth.entities';

export const API_KEY_HEADER = 'X-API-KEY';

export interface ApiKeyRequest {
  isApiKeyRequest: boolean;
  apiKey: AdminApiKey;
}

export function isApiKeyRequest(req: Request): req is AnyAuthRequest<ApiKeyPayload, AdminUser> {
  return !!getIgnoreCase(req.headers, API_KEY_HEADER);
}
