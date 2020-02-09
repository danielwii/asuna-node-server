import { DynamicModule, Module, OnModuleInit } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { GraphQLModule } from '@nestjs/graphql';
import { RedisCache } from 'apollo-server-cache-redis';
import { InMemoryLRUCache } from 'apollo-server-caching';
import * as responseCachePlugin from 'apollo-server-plugin-response-cache';
import * as GraphQLJSON from 'graphql-type-json';
import * as _ from 'lodash';
import { join } from 'path';
import { AppModule } from './app';
import { r } from './common/helpers';
import { LoggerFactory } from './common/logger';
import { ConfigKeys, configLoader } from './config';
import { AsunaContext, KvModule } from './core';
import { DataLoaderInterceptor, GraphqlContext } from './dataloader';
import { RedisProvider } from './providers';

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

    const redis = RedisProvider.instance.getRedisClient('graphql');
    const cache = redis.isEnabled ? new RedisCache(redis.redisOptions as any) : new InMemoryLRUCache();
    logger.log(`cache is ${r(cache, { depth: 1 })}`);

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
          playground: configLoader.loadBoolConfig(ConfigKeys.GRAPHQL_PLAYGROUND_ENABLE),
          debug: AsunaContext.isDebugMode,
          introspection: AsunaContext.isDebugMode,
          tracing: AsunaContext.isDebugMode,
          resolverValidationOptions: {
            requireResolversForResolveType: false,
          },
          persistedQueries: { cache },
          plugins: [
            (responseCachePlugin as any)({
              sessionId: requestContext => {
                const sessionID = requestContext.request.http.headers.get('sessionid') || null;
                if (sessionID) logger.verbose(`cache sessionID: ${sessionID}`);
                return sessionID;
              },
            }),
          ],
          cacheControl: {
            defaultMaxAge: 5,
            stripFormattedExtensions: false,
            calculateHttpHeaders: true,
          },
          context: (context): GraphqlContext<any> => ({
            ...context,
            getDataLoaders: () => _.get(context.req, 'dataLoaders'),
            getCurrentUser: () => _.get(context.req, 'user'),
          }),
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
      providers: [{ provide: APP_INTERCEPTOR, useClass: DataLoaderInterceptor }],
    };
  }

  onModuleInit(): void {
    logger.log('init...');
  }
}
