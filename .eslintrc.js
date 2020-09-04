module.exports = {
  extends: ['alloy', 'alloy/typescript'],
  env: {
    node: true,
    // browser: false,
    jest: true,
  },
  rules: {
    'max-params': 'off',
    // Use function hoisting to improve code readability
    '@typescript-eslint/no-parameter-properties': 'off',
  },
};
