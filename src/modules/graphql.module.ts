import { DynamicModule, Module, OnModuleInit } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { GraphQLModule } from '@nestjs/graphql';
import OpenTracingExtension from 'apollo-opentracing';
import { RedisCache } from 'apollo-server-cache-redis';
import { InMemoryLRUCache } from 'apollo-server-caching';
import responseCachePlugin from 'apollo-server-plugin-response-cache';
import { GraphQLServiceContext, ValueOrPromise } from 'apollo-server-types';
import GraphQLJSON from 'graphql-type-json';
import * as _ from 'lodash';
import * as path from 'path';
import { AppModule } from './app';
import { r } from './common/helpers';
import { LoggerFactory } from './common/logger';
import { KvModule } from './core';
import { DataLoaderInterceptor, GraphqlContext } from './dataloader';
import { GraphQLConfigObject } from './graphql/graphql.config';
import { RedisProvider } from './providers';
import { TracingHelper } from './tracing';
import { TracingConfigObject } from './tracing/tracing.config';

const logger = LoggerFactory.getLogger('GraphqlModule');

@Module({})
export class GraphqlModule implements OnModuleInit {
  public static forRoot(dir: string, modules = [], options?): DynamicModule {
    // const providers = createDatabaseProviders(options, entities);
    const tracer = TracingHelper.init();
    const tracingConfig = TracingConfigObject.load();
    const config = GraphQLConfigObject.load();
    const typePaths = _.uniq([
      dir,
      path.resolve(__dirname, '../../src/**/*.graphql'),
      `${path.join(require.main.path, '../src')}/**/*.graphql`,
    ]);
    logger.log(`init graphql ${r({ tracingConfig, typePaths, config, main: require.main.path, dir, options })}`);

    const redis = RedisProvider.instance.getRedisClient('graphql');
    const cache = redis.isEnabled ? new RedisCache(redis.redisOptions as any) : new InMemoryLRUCache();
    logger.log(`load cache ${r(cache, { depth: 1 })}`);

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
          playground: config.playground_enable,
          debug: config.debug,
          introspection: config.playground_enable || config.debug,
          tracing: config.debug,
          resolverValidationOptions: { requireResolversForResolveType: false },
          persistedQueries: { cache },
          plugins: [
            {
              serverWillStart(service: GraphQLServiceContext): ValueOrPromise<void> {
                logger.log(`GraphQL Server starting! ${r(_.pick(service, 'schemaHash', 'engine'))}`);
              },
            },
            (responseCachePlugin as any)({
              sessionID: (requestContext) => {
                const sessionID = requestContext.request.http.headers.get('sessionid');
                if (sessionID) logger.debug(`cache sessionID: ${sessionID}`);
                return sessionID;
              },
            }),
          ],
          cacheControl: {
            // defaultMaxAge: 5,
            stripFormattedExtensions: false,
            calculateHttpHeaders: true,
          },
          context: (context): GraphqlContext => ({
            ...context,
            getDataLoaders: () => _.get(context.req, 'dataLoaders'),
            getCurrentUser: () => _.get(context.req, 'user'),
            getTrace: () => _.get(context.req, 'trace'),
          }),
          extensions: _.compact([
            tracingConfig.enabled
              ? _.memoize(() => {
                  const openTracingExtension = new (OpenTracingExtension as any)({
                    server: tracer,
                    local: tracer,
                    // shouldTraceRequest: info => true,
                    // shouldTraceFieldResolver: (source, args, context, info) => true,
                  });
                  logger.log(`load open tracing extension ...`);
                  return openTracingExtension;
                })
              : undefined,
          ]),
          formatResponse: (response) => {
            if (response.errors) {
              logger.error(`response: ${r(response.errors)}`);
            }
            // logger.verbose(`response: ${r(response.data)}`);
            return response;
          },
        }),
      ],
      providers: [{ provide: APP_INTERCEPTOR, useClass: DataLoaderInterceptor }],
    };
  }

  public onModuleInit(): void {
    logger.log('init...');
  }
}
