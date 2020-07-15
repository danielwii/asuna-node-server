const { jsWithTs: tsjPreset } = require('ts-jest/presets');

module.exports = {
  verbose: true,
  preset: 'ts-jest',
  testEnvironment: 'node',
  moduleDirectories: ['node_modules', 'src'],
  testRegex: '.spec.tsx?$',
  moduleFileExtensions: ['js', 'json', 'ts', 'graphql'],
  setupFilesAfterEnv: ['./jest.setup.js'],
  collectCoverage: true,
  transform: {
    ...tsjPreset.transform,
  },
  globals: { 'ts-jest': { diagnostics: { ignoreCodes: [151001] } } },
};
