import type { VirtualDevice, VirtualSession } from '../core/device';

export type CommonRequest = { isMobile?: boolean } & { sessionID?: string } & {
  session?: { landingUrl: string; referer: string; origin: string; deviceId: string };
  signedCookies?: { deviceId?: string };
  virtualSession?: VirtualSession;
  virtualDevice?: VirtualDevice;
};
