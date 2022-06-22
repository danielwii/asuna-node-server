import { AbstractConfigLoader } from '@danielwii/asuna-helper/dist/config';
import { withP, withP2 } from '@danielwii/asuna-helper/dist/utils';

import { configLoader } from '../../config';

export enum AppleConfigKeys {
  enable = 'enable',
  clientID = 'client_id',
  teamID = 'team_id',
  privateKey = 'private_key',
  keyIdentifier = 'key_identifier',
  // redirectUri = 'redirectUri',
  // audience = 'audience',
}

export class AppleConfigObject extends AbstractConfigLoader<AppleConfigObject> {
  private static key = 'signin.apple';
  private static _: AppleConfigObject;

  static get instance() {
    if (AppleConfigObject._) {
      return AppleConfigObject._;
    }
    AppleConfigObject._ = this.load();
    return AppleConfigObject._;
  }

  enable: boolean;
  clientID: string;
  teamID: string;
  privateKey: string;
  keyIdentifier: string;
  redirectUri: string;
  // audience: string;

  static load = (reload = false): AppleConfigObject => {
    if (AppleConfigObject._ && !reload) {
      return AppleConfigObject._;
    }
    AppleConfigObject._ = withP2(
      (p): any => configLoader.loadConfig2(AppleConfigObject.key, p),
      AppleConfigKeys,
      (loader, keys) =>
        new AppleConfigObject({
          enable: withP(keys.enable, loader),
          clientID: withP(keys.clientID, loader),
          teamID: withP(keys.teamID, loader),
          privateKey: withP(keys.privateKey, loader).replace(/\\n/g, '\n'),
          keyIdentifier: withP(keys.keyIdentifier, loader),
          redirectUri: `${configLoader.loadConfig('MASTER_ADDRESS')}/api/v1/auth/apple/callback`,
          // audience: withP(keys.audience, loader),
        }),
    );
    return AppleConfigObject._;
  };
}
