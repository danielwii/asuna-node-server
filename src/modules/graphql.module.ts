import responseCachePlugin from '@apollo/server-plugin-response-cache';

import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { DynamicModule, Logger, Module, OnModuleInit } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { CustomScalar, GraphQLModule, Scalar } from '@nestjs/graphql';

import { InitContainer } from '@danielwii/asuna-helper/dist/init';
import { resolveModule } from '@danielwii/asuna-helper/dist/logger/factory';
import { RedisConfigObject } from '@danielwii/asuna-helper/dist/providers/redis/config';
import { r } from '@danielwii/asuna-helper/dist/serializer';

import { RedisCache } from 'apollo-server-cache-redis';
import { InMemoryLRUCache } from 'apollo-server-caching';
import { ApolloServerPluginCacheControl } from 'apollo-server-core';
// TODO The `apollo-tracing` package is no longer part of Apollo Server 3. See https://www.apollographql.com/docs/apollo-server/migration/#tracing for details
import { plugin as apolloTracingPlugin } from 'apollo-tracing';
import {
  DirectiveLocation,
  GraphQLBoolean,
  GraphQLDirective,
  GraphQLEnumType,
  GraphQLInt,
  Kind,
  ValueNode,
} from 'graphql';
import _ from 'lodash';
import { dirname, join, resolve } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

import { AppModule } from './app';
import { KvModule } from './core';
import { DataLoaderInterceptor, GraphqlContext } from './dataloader';
import { GraphQLConfigObject } from './graphql/graphql.config';
import { TracingHelper } from './tracing';
import { TracingConfigObject } from './tracing/tracing.config';

import type { GraphQLServiceContext } from 'apollo-server-types';
import type { GraphQLRequestContext } from '@apollo/server';

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
  private readonly logger = new Logger(resolveModule(fileURLToPath(import.meta.url), GraphqlModule.name));

  public static forRoot(modules = [], options?): DynamicModule {
    // const providers = createDatabaseProviders(options, entities);
    const tracer = TracingHelper.init();
    const tracingConfig = TracingConfigObject.load();
    const config = GraphQLConfigObject.load();
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);
    const __entrance = pathToFileURL(process.argv[1]).href;
    const __rootPath = dirname(dirname(fileURLToPath(__entrance)));
    console.log('-=-=-=-=-', {
      __dirname,
      __rootPath,
    });
    const typePaths = _.uniq(
      _.compact([
        __rootPath.includes('asuna-node-server') ? null : resolve(__dirname, '../../../*/src/**/*.graphql'),
        `${join(__rootPath, '../src')}/**/*.graphql`,
      ]),
    );
    Logger.log(`init graphql ${r({ tracingConfig, typePaths, config, main: __rootPath, __dirname, options })}`);

    const redisConfig = RedisConfigObject.load('graphql');
    const cache = redisConfig.enable ? new RedisCache(redisConfig.getIoOptions()) : new InMemoryLRUCache();
    Logger.log(`load cache ${r(cache, { depth: 1 })}`);

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
          // playground: false,
          debug: config.debug,
          introspection: config.playground_enable || config.debug,
          // tracing: config.debug,
          resolverValidationOptions: { requireResolversForResolveType: 'warn' },
          cache,
          persistedQueries: { cache },
          // TODO https://github.com/nestjs/graphql/pull/2139
          buildSchemaOptions: {
            directives: [
              new GraphQLDirective({
                name: 'cacheControl',
                locations: [
                  DirectiveLocation.FIELD_DEFINITION,
                  DirectiveLocation.OBJECT,
                  DirectiveLocation.INTERFACE,
                  DirectiveLocation.UNION,
                ],
                args: {
                  maxAge: { type: GraphQLInt },
                  scope: {
                    type: new GraphQLEnumType({
                      name: 'CacheControlScope',
                      values: {
                        PUBLIC: {},
                        PRIVATE: {},
                      },
                    }),
                  },
                  inheritMaxAge: { type: GraphQLBoolean },
                },
              }),
            ],
          },
          plugins: _.compact([
            {
              async serverWillStart(service: GraphQLServiceContext) {
                Logger.log(`GraphQL Server starting! ${r(_.pick(service, 'schemaHash', 'engine'))}`);
              },
            },
            responseCachePlugin({
              sessionId: async (requestContext) => {
                const sessionID = requestContext.request.http.headers.get('sessionid');
                if (sessionID) Logger.debug(`cache sessionID: ${sessionID}`);
                return sessionID;
              },
            }),
            // config.playground_enable ? ApolloServerPluginLandingPageLocalDefault() : null,
            ApolloServerPluginCacheControl({ defaultMaxAge: 1, calculateHttpHeaders: false }),
            config.debug ? (apolloTracingPlugin() as any) : null,
          ]),
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
            getPayload: () => _.get(context.req, 'payload'),
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
              Logger.error(`response: ${r(response.errors)}`);
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
