module.exports = {
  parser: '@typescript-eslint/parser',
  parserOptions: { project: './tsconfig.json' },
  plugins: ['@typescript-eslint', 'eslint-comments', 'jest', 'promise', 'unicorn', 'prettier'],
  extends: [
    'airbnb-typescript/base',
    'plugin:@typescript-eslint/recommended',
    'plugin:eslint-comments/recommended',
    'plugin:jest/recommended',
    'plugin:promise/recommended',
    'plugin:unicorn/recommended',
    'plugin:prettier/recommended',
    'prettier',
    'prettier/react',
    'prettier/@typescript-eslint',
  ],
  env: {
    node: true,
    browser: false,
    jest: true,
  },
  rules: {
    'prettier/prettier': 'warn',
    // Too restrictive, writing ugly code to defend against a very unlikely scenario: https://eslint.org/docs/rules/no-prototype-builtins
    'no-prototype-builtins': 'off',
    // https://basarat.gitbooks.io/typescript/docs/tips/defaultIsBad.html
    '@typescript-eslint/lines-between-class-members': 'off',
    '@typescript-eslint/no-implied-eval': 'off',
    '@typescript-eslint/no-throw-literal': 'off',
    'import/prefer-default-export': 'off',
    'import/no-named-default': 'off',
    'import/no-default-export': 'warn',
    'import/no-duplicates': 'off',
    'max-classes-per-file': 'off',
    'lines-between-class-members': 'off',
    'no-useless-constructor': 'off',
    'no-underscore-dangle': 'off',
    'no-dupe-class-members': 'off',
    'class-methods-use-this': 'warn',
    'import/no-extraneous-dependencies': 'off',
    // 'import/no-extraneous-dependencies': [
    //   'error',
    //   { devDependencies: ['**/*test.ts', '**/*spec.ts'], optionalDependencies: false, peerDependencies: false },
    // ],
    // Too restrictive: https://github.com/yannickcr/eslint-plugin-react/blob/master/docs/rules/destructuring-assignment.md
    // 'react/destructuring-assignment': 'off',
    // No jsx extension: https://github.com/facebook/create-react-app/issues/87#issuecomment-234627904
    // 'react/jsx-filename-extension': 'off',
    // Use function hoisting to improve code readability
    '@typescript-eslint/no-parameter-properties': 'off',
    '@typescript-eslint/no-inferrable-types': 'off',
    '@typescript-eslint/camelcase': 'off',
    // Makes no sense to allow type inferrence for expression parameters, but require typing the response
    '@typescript-eslint/explicit-function-return-type': [
      'warn',
      { allowExpressions: true, allowTypedFunctionExpressions: true },
    ],
    '@typescript-eslint/no-use-before-define': [
      'error',
      { functions: false, classes: true, variables: false, typedefs: true },
    ],
    // Common abbreviations are known and readable
    'unicorn/prevent-abbreviations': 'off',
    'unicorn/catch-error-name': 'off',
    'unicorn/no-fn-reference-in-iterator': 'off',
  },
};
