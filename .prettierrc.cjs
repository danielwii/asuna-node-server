// @ts-check

/** @type {import("@serverless-guru/prettier-plugin-import-order").PrettierConfig} */
module.exports = {
  printWidth: 120,
  trailingComma: 'all',
  singleQuote: true,
  importOrderTypeImportsToBottom: true,
  importOrder: ['^@nestjs/(.*)$', '^@danielwii/(.*)$', '^@local/(.*)$', '([a-zA-Z].:.*)', '^([a-zA-Z].*)', '^[./]'],
  importOrderParserPlugins: ['typescript', 'jsx', 'decorators-legacy'],
  importOrderMergeDuplicateImports: true,
  importOrderSeparation: true,
  importOrderSortIndividualImports: true,
};
