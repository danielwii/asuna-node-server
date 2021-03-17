export type CommonRequest = { isMobile?: boolean } & { sessionID?: string; deviceID?: string } & {
  session?: { landingUrl: string; referer: string; origin: string; deviceId: string };
  signedCookies?: { 'asn.sdid'?: string };
  scid?: string;
};
