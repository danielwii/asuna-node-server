const { resolve } = require('path');

jest.setTimeout(30000);
process.mainModule = { filename: resolve(__dirname, '../src/') };
