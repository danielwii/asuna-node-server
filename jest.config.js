module.exports = {
  verbose: true,
  preset: 'ts-jest',
  testEnvironment: 'node',
  moduleDirectories: ['node_modules', 'src'],
  testRegex: '.spec.tsx?$',
  moduleFileExtensions: ['js', 'json', 'ts', 'graphql'],
  setupFilesAfterEnv: ['./jest.setup.js'],
};
