import { ConfigureLoader, YamlConfigKeys } from '../core/config';

export enum FirebaseConfigKeys {
  enable = 'enable',
  databaseUrl = 'database_url',
}

export class FirebaseConfigObject implements Record<keyof typeof FirebaseConfigKeys, any> {
  public enable: boolean;
  public databaseUrl: string;
}

export interface FirebaseConfigure extends ConfigureLoader<FirebaseConfigObject> {}
@ConfigureLoader(YamlConfigKeys.firebase, FirebaseConfigKeys, FirebaseConfigObject)
export class FirebaseConfigure {}
