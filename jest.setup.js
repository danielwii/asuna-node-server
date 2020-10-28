const { resolve } = require('path');

jest.setTimeout(60000);
require.main = { filename: resolve(__filename, '../src/entrance.ts') };
