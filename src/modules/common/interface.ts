export type SignedCookies = { 'asn.sdid': string; 'asn.scid': string; 'asn.seid': string };

export type CommonRequest = { isMobile?: boolean } & { sessionID?: string; deviceID?: string } & {
  session?: { landingUrl: string; referer: string; origin: string; deviceId: string };
  signedCookies?: SignedCookies;
  scid?: string;
};
