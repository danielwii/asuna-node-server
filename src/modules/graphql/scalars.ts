import { GraphQLScalarType, Kind } from 'graphql';

export const TimeOfDayScalar = new GraphQLScalarType({
  name: 'TimeOfDay',
  description: 'Time of day',
  serialize(value) {
    return value;
  },
  parseValue(value) {
    return value;
  },
  parseLiteral(ast) {
    if (ast.kind === Kind.STRING) {
      return ast.value;
    }
    return null;
  },
});
