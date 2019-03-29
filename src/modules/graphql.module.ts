import { Logger, Module, OnModuleInit } from '@nestjs/common';
import { GraphQLModule } from '@nestjs/graphql';
import * as util from 'util';

import { KvModule } from './kv';
import { ReleaseModule } from './release';

const logger = new Logger('GraphqlModule');

@Module({
  imports: [
    KvModule,
    ReleaseModule,
    GraphQLModule.forRoot({
      typePaths: ['../**/*.graphql'],
      // introspection: true,
      // debug: true,
      playground: true,
      resolverValidationOptions: {
        requireResolversForResolveType: false,
      },
      context: context => {
        return { ...context, getDataLoaders: () => (context.req as any).dataLoaders };
      },
      // tracing: true,
      /*      extensions: _.compact([
        configLoader.loadConfig(ConfigKeys.TRACING)
          ? () =>
              new OpenTracingExtension({
                server: tracer,
                local: graphqlTracer,
                shouldTraceRequest: info => true,
                shouldTraceFieldResolver: (source, args, context, info) => true,
              }) as any
          : undefined,
      ]),*/
      formatResponse: response => {
        if (response.errors) {
          logger.warn(util.inspect(response.errors, { colors: true }));
        }
        return response;
      },
    }),
  ],
})
export class GraphqlModule implements OnModuleInit {
  public onModuleInit() {
    logger.log('init...');
  }
}
