import { Logger, Module, OnModuleInit } from '@nestjs/common';

import { InitContainer } from '@danielwii/asuna-helper/dist/init';
import { resolveModule } from '@danielwii/asuna-helper/dist/logger/factory';
import { r } from '@danielwii/asuna-helper/dist/serializer';

import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import admin from 'firebase-admin';
import fs from 'fs-extra';
import _ from 'lodash';

import { FirebaseConfigure } from './configure';
import { FirebaseController } from './controller';

const config = new FirebaseConfigure().load();

@Module({
  providers: [],
  controllers: _.compact([config.enable ? FirebaseController : undefined]),
})
export class FirebaseModule extends InitContainer implements OnModuleInit {
  private readonly logger = new Logger(resolveModule(fileURLToPath(import.meta.url), this.constructor.name));

  public onModuleInit = async (): Promise<void> =>
    super.init(async () => {
      const config = new FirebaseConfigure().load();
      this.logger.log(`firebase config ${r({ config })}`);
      if (config.enable) {
        const path = resolve('./serviceAccountKey.json');
        this.logger.log(`load service account from: ${path}`);
        const serviceAccount = JSON.parse(fs.readFileSync(path).toString());
        const app = admin.initializeApp({
          credential: admin.credential.cert(serviceAccount),
          // databaseURL: config.databaseUrl,
        });
        this.logger.log(`init firebase app ${r(app.name)}`);
      }
    });
}
