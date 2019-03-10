import { Module } from '@nestjs/common';
import { DBService } from '../base/db.service';
import { SchemaQueryResolver } from './schema.resolver';

@Module({
  providers: [SchemaQueryResolver, DBService],
})
export class SchemaModules {}
