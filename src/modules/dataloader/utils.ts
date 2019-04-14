import { ExecutionContext } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { GraphQLResolveInfo } from 'graphql';

export interface Request {
  id?: string;
  user?: string;
  dataLoaders: object;
}

export function getRequestFromContext(context: ExecutionContext): Request {
  const request = context.switchToHttp().getRequest<Request>();

  // console.log('getRequestFromContext', request);
  // Graphql endpoints need a context creation
  if (!request) {
    const ctx = GqlExecutionContext.create(context);
    return ctx.getContext().req;
  } else {
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
}
