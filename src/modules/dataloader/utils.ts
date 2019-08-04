import { ExecutionContext } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { GraphQLResolveInfo } from 'graphql';

export type DataLoaderFunction<T> = {
  load: (ids: any | any[]) => T[];
};

export type GraphqlRequest = Request & {
  id?: string;
  user?: string;
  dataLoaders: { [key: string]: DataLoaderFunction<any> };
};

export function getRequestFromContext(context: ExecutionContext): GraphqlRequest {
  const request = context.switchToHttp().getRequest<GraphqlRequest>();

  // Graphql endpoints need a context creation
  if (!request) {
    const ctx = GqlExecutionContext.create(context);
    return ctx.getContext().req;
  }

  // Interestingly, graphql field resolvers pass through the guards again. I suppose that's good?
  // These executions however provide different inputs than a fresh Http or GQL request.
  // In order to authenticate these, we can retrieve the original request from the context
  // that we configured in the GraphQL options in app.module.
  // I assign a user to every request in a middleware not shown here
  if (!request.user) {
    const [parent, ctx, info]: [any, any, GraphQLResolveInfo] = context.getArgs();

    // Checking if this looks like a GQL subquery, is this hacky?
    if (parent && info && info.parentType) {
      return ctx.req;
    }
  }

  return request;
}
