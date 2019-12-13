import { DynamicModule, Module, OnModuleInit } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { GraphQLModule } from '@nestjs/graphql';
import * as GraphQLJSON from 'graphql-type-json';
import * as _ from 'lodash';
import { join } from 'path';
import { AppModule } from './app';
import { r } from './common/helpers';
import { LoggerFactory } from './common/logger';
import { AbstractAuthUser, AsunaContext, KvModule } from './core';
import { DataLoaderInterceptor, GraphqlContext } from './dataloader';

const logger = LoggerFactory.getLogger('GraphqlModule');

@Module({})
export class GraphqlModule implements OnModuleInit {
  static forRoot(dir, modules = [], options?): DynamicModule {
    // const providers = createDatabaseProviders(options, entities);
    const typePaths = [
      // '../**/*.graphql',
      `${join(__dirname, '../../src')}/**/*.graphql`,
      `${join(dir, '../src')}/**/*.graphql`,
    ];
    logger.log(`typePaths is ${r({ typePaths })}`);

    return {
      module: GraphqlModule,
      imports: [
        ...modules,
        KvModule,
        AppModule,
        GraphQLModule.forRoot({
          // definitions: {
          //   path: join(process.cwd(), 'src/graphql.generated.ts'),
          //   outputAs: 'class',
          // },
          typePaths,
          // autoSchemaFile: 'schema.gql',
          resolvers: { JSON: GraphQLJSON },
          introspection: AsunaContext.isDebugMode,
          debug: AsunaContext.isDebugMode,
          playground: true,
          resolverValidationOptions: {
            requireResolversForResolveType: false,
          },
          context: (context): GraphqlContext<any> => ({
            ...context,
            getDataLoaders: () => _.get(context.req, 'dataLoaders'),
            getCurrentUser: (): AbstractAuthUser => _.get(context.req, 'user'),
          }),
          tracing: AsunaContext.isDebugMode,
          /*          extensions: _.compact([
            configLoader.loadConfig(ConfigKeys.TRACING)
              ? () =>
                  new OpenTracingExtension({
                    server: tracer,
                    local: graphqlTracer,
                    shouldTraceRequest: info => true,
                    shouldTraceFieldResolver: (source, args, context, info) => true,
                  }) as any
              : undefined,
          ]), */
          formatResponse: response => {
            if (response.errors) {
              logger.warn(`response: ${r(response.errors)}`);
            }
            // logger.debug(`response: ${r(response.data)}`);
            return response;
          },
        }),
      ],
      providers: [
        {
          provide: APP_INTERCEPTOR,
          useClass: DataLoaderInterceptor,
        },
      ],
    };
  }

  onModuleInit(): void {
    logger.log('init...');
  }
}
