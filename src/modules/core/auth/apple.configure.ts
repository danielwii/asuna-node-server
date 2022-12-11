import { withP, withP2 } from '@danielwii/asuna-helper/dist/utils';
import { deserializeSafely } from '@danielwii/asuna-helper/dist/validate';

import { EnvConfigure, configLoader } from '../../config';

export enum AppleConfigKeys {
  enable = 'enable',
  clientID = 'client_id',
  teamID = 'team_id',
  privateKey = 'private_key',
  keyIdentifier = 'key_identifier',
  // redirectUri ='redirectUri',
  // audience ='audience',
}

export class AppleConfigObject implements Record<keyof typeof AppleConfigKeys, any> {
  public enable: boolean;
  public clientID: string;
  public teamID: string;
  public privateKey: string;
  public keyIdentifier: string;
  public redirectUri: string;
  // public audience: string;
}

export class AppleConfigure {
  public static readonly key = 'signin.apple';

  public static load = (): Promise<AppleConfigObject> =>
    EnvConfigure.load<AppleConfigObject>(this.key, () =>
      withP2(
        (p): any => configLoader.loadConfig2(this.key, p),
        AppleConfigKeys,
        (loader, keys) =>
          deserializeSafely(AppleConfigObject, {
            enable: withP(keys.enable, loader),
            clientID: withP(keys.clientID, loader),
            teamID: withP(keys.teamID, loader),
            privateKey: withP(keys.privateKey, loader).replace(/\\n/g, '\n'),
            keyIdentifier: withP(keys.keyIdentifier, loader),
            redirectUri: `${configLoader.loadConfig('MASTER_ADDRESS')}/api/v1/auth/apple/callback`,
            // audience: withP(keys.audience, loader),
          }),
      ),
    );
}
