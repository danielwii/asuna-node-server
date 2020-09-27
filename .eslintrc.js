module.exports = {
  extends: [
    'eslint:recommended',
    'plugin:import/errors',
    'plugin:import/warnings',
    'plugin:import/typescript',
    'alloy',
    'alloy/typescript',
  ],
  env: {
    node: true,
    // browser: false,
    jest: true,
  },
  rules: {
    'import/no-cycle': ['error'],
    'max-params': 'off',
    // Use function hoisting to improve code readability
    '@typescript-eslint/no-parameter-properties': 'off',
    '@typescript-eslint/member-ordering': 'off',
  },
};
