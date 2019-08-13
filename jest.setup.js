const { resolve } = require('path');

jest.setTimeout(60000);
process.mainModule = { filename: resolve(__dirname, '../src/') };
