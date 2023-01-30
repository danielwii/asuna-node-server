import { Module, OnModuleInit } from '@nestjs/common';

import { InitContainer } from '@danielwii/asuna-helper/dist/init';

import { DBService } from '../core/db';
import { SchemaQueryResolver } from './schema.resolver';
import { UserProfileQueryResolver, UserProfileResolver } from './user/user.resolver';

@Module({
  providers: [SchemaQueryResolver, UserProfileQueryResolver, UserProfileResolver, DBService],
})
export class GraphqlQueryModule extends InitContainer implements OnModuleInit {
  public onModuleInit = async (): Promise<void> => super.init();
}
