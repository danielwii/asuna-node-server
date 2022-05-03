import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { DynamicModule, Module, OnModuleInit } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { CustomScalar, GraphQLModule, Scalar } from '@nestjs/graphql';

import { InitContainer } from '@danielwii/asuna-helper/dist/init';
import { LoggerFactory } from '@danielwii/asuna-helper/dist/logger/factory';
import { RedisConfigObject } from '@danielwii/asuna-helper/dist/providers/redis/config';
import { r } from '@danielwii/asuna-helper/dist/serializer';

import { RedisCache } from 'apollo-server-cache-redis';
import { InMemoryLRUCache } from 'apollo-server-caching';
import responseCachePlugin from 'apollo-server-plugin-response-cache';
import { Kind, ValueNode } from 'graphql';
import * as _ from 'lodash';
import * as path from 'path';

import { AppModule } from './app';
import { KvModule } from './core';
import { DataLoaderInterceptor, GraphqlContext } from './dataloader';
import { GraphQLConfigObject } from './graphql/graphql.config';
import { TracingHelper } from './tracing';
import { TracingConfigObject } from './tracing/tracing.config';

import type { RedisOptions } from 'ioredis';
import type { GraphQLServerListener } from 'apollo-server-plugin-base';
import type { GraphQLServiceContext } from 'apollo-server-types';

const logger = LoggerFactory.getLogger('GraphqlModule');

@Scalar('DateTime', (type) => Date)
export class DateScalar implements CustomScalar<number, Date> {
  description = 'Date custom scalar type';

  parseValue(value: number): Date {
    return new Date(value); // value from the client
  }

  serialize(value: Date): number {
    if (_.isString(value)) {
      // FIXME fix BaseEntity @CreateDateColumn({ name: 'created_at' }) format issue
      return value as any;
    } else {
      return value.getTime(); // value sent to the client
    }
  }

  parseLiteral(ast: ValueNode): Date {
    if (ast.kind === Kind.INT) {
      return new Date(ast.value);
    }
    return null;
  }
}

@Module({ providers: [DateScalar] })
export class GraphqlModule extends InitContainer implements OnModuleInit {
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

    const redisConfig = RedisConfigObject.load('graphql');
    const cache = redisConfig.enable ? new RedisCache(redisConfig.getIoOptions()) : new InMemoryLRUCache();
    logger.log(`load cache ${r(cache, { depth: 1 })}`);

    return {
      module: GraphqlModule,
      imports: [
        ...modules,
        KvModule,
        AppModule,
        GraphQLModule.forRoot<ApolloDriverConfig>({
          driver: ApolloDriver,
          // definitions: {
          //   path: join(process.cwd(), 'src/graphql.generated.ts'),
          //   outputAs: 'class',
          // },
          // typePaths,
          autoSchemaFile: 'auto-schema.gql',
          // autoSchemaFile: true,
          sortSchema: true,
          installSubscriptionHandlers: true,
          // resolvers: { JSON: GraphQLJSON },
          playground: config.playground_enable,
          debug: config.debug,
          introspection: config.playground_enable || config.debug,
          // tracing: config.debug,
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
          /*
          cacheControl: {
            // defaultMaxAge: 5,
            stripFormattedExtensions: false,
            calculateHttpHeaders: true,
          },
          */
          context: (context): GraphqlContext => ({
            ...context,
            getDataLoaders: () => _.get(context.req, 'dataLoaders'),
            getCurrentUser: () => _.get(context.req, 'user'),
            getTrace: () => _.get(context.req, 'trace'),
            getTenant: () => _.get(context.req, 'tenant'),
          }),
          /*
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
          */
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

  public onModuleInit = () => super.init();
}
