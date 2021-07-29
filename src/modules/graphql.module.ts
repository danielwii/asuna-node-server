import { DynamicModule, Module, OnModuleInit } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { GraphQLModule } from '@nestjs/graphql';

import { LoggerFactory } from '@danielwii/asuna-helper/dist/logger';
import { RedisProvider } from '@danielwii/asuna-helper/dist/providers/redis/provider';
import { r } from '@danielwii/asuna-helper/dist/serializer';

import OpenTracingExtension from 'apollo-opentracing';
import { RedisCache } from 'apollo-server-cache-redis';
import { InMemoryLRUCache } from 'apollo-server-caching';
import responseCachePlugin from 'apollo-server-plugin-response-cache';
import GraphQLJSON from 'graphql-type-json';
import * as _ from 'lodash';
import * as path from 'path';

import { AppModule } from './app';
import { KvModule } from './core';
import { DataLoaderInterceptor, GraphqlContext } from './dataloader';
import { GraphQLConfigObject } from './graphql/graphql.config';
import { TracingHelper } from './tracing';
import { TracingConfigObject } from './tracing/tracing.config';

import type { GraphQLServerListener } from 'apollo-server-plugin-base';
import type { GraphQLServiceContext } from 'apollo-server-types';

const logger = LoggerFactory.getLogger('GraphqlModule');

@Module({})
export class GraphqlModule implements OnModuleInit {
  public static forRoot(modules = [], options?): DynamicModule {
    // const providers = createDatabaseProviders(options, entities);
    const tracer = TracingHelper.init();
    const tracingConfig = TracingConfigObject.load();
    const config = GraphQLConfigObject.load();
    const typePaths = _.uniq(
      _.compact([
        require.main.path.includes('asuna-node-server') ? null : path.resolve(__dirname, '../../../*/src/**/*.graphql'),
        `${path.join(require.main.path, '../src')}/**/*.graphql`,
      ]),
    );
    logger.log(`init graphql ${r({ tracingConfig, typePaths, config, main: require.main.path, __dirname, options })}`);

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
          // autoSchemaFile: true,
          // sortSchema: true,
          installSubscriptionHandlers: true,
          resolvers: { JSON: GraphQLJSON },
          playground: config.playground_enable,
          debug: config.debug,
          introspection: config.playground_enable || config.debug,
          tracing: config.debug,
          resolverValidationOptions: { requireResolversForResolveType: 'warn' },
          persistedQueries: { cache },
          plugins: [
            {
              async serverWillStart(service: GraphQLServiceContext): Promise<GraphQLServerListener | void> {
                logger.log(`GraphQL Server starting! ${r(_.pick(service, 'schemaHash', 'engine'))}`);
              },
            },
            responseCachePlugin({
              sessionId: (requestContext) => {
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
            getTenant: () => _.get(context.req, 'tenant'),
          }),
          extensions: _.compact([
            tracingConfig.enabled
              ? _.memoize(() => {
                  const openTracingExtension = OpenTracingExtension({
                    server: tracer,
                    local: tracer,
                    // shouldTraceRequest: info => true,
                    // shouldTraceFieldResolver: (source, args, context, info) => true,
                  });
                  logger.log(`load open tracing extension ...`);
                  return openTracingExtension as any;
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
