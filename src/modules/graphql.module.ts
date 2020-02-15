import { DynamicModule, Module, OnModuleInit } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { GraphQLModule } from '@nestjs/graphql';
import { default as OpentracingExtension } from 'apollo-opentracing';
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
import { KvModule } from './core';
import { DataLoaderInterceptor, GraphqlContext } from './dataloader';
import { RedisProvider } from './providers';
import { TracingHelper } from './tracing';

const logger = LoggerFactory.getLogger('GraphqlModule');

@Module({})
export class GraphqlModule implements OnModuleInit {
  static forRoot(dir, modules = [], options?): DynamicModule {
    // const providers = createDatabaseProviders(options, entities);
    const tracer = TracingHelper.init();

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
          debug: configLoader.loadBoolConfig(ConfigKeys.GRAPHQL_DEBUG),
          introspection: configLoader.loadBoolConfig(ConfigKeys.GRAPHQL_DEBUG),
          tracing: configLoader.loadBoolConfig(ConfigKeys.GRAPHQL_DEBUG),
          resolverValidationOptions: {
            requireResolversForResolveType: false,
          },
          persistedQueries: { cache },
          plugins: [
            {
              serverWillStart() {
                logger.log('Server starting!');
              },
            },
            (responseCachePlugin as any)({
              sessionId: requestContext => {
                const sessionID = requestContext.request.http.headers.get('sessionid') || null;
                if (sessionID) logger.verbose(`cache sessionID: ${sessionID}`);
                return sessionID;
              },
            }),
          ],
          cacheControl: {
            // defaultMaxAge: 5,
            stripFormattedExtensions: false,
            calculateHttpHeaders: true,
          },
          context: (context): GraphqlContext<any> => ({
            ...context,
            getDataLoaders: () => _.get(context.req, 'dataLoaders'),
            getCurrentUser: () => _.get(context.req, 'user'),
            getTrace: () => _.get(context.req, 'trace'),
          }),
          extensions: _.compact([
            configLoader.loadBoolConfig('JAEGER_ENABLED', false)
              ? () => {
                  const opentracingExtension = new OpentracingExtension({
                    server: tracer,
                    local: tracer,
                    // shouldTraceRequest: info => true,
                    // shouldTraceFieldResolver: (source, args, context, info) => true,
                  });
                  logger.log(`load opentracingExtension ...`);
                  return opentracingExtension;
                }
              : undefined,
          ]),
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
