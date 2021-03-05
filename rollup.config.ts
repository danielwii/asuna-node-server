import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import eslint from '@rollup/plugin-eslint';
import auto from '@rollup/plugin-auto-install';
import strip from '@rollup/plugin-strip';
import typescript from 'rollup-plugin-typescript2';
import postcss from 'rollup-plugin-postcss';
import cleanup from 'rollup-plugin-cleanup';
import del from 'rollup-plugin-delete';
import sourceMaps from 'rollup-plugin-sourcemaps';
import sizes from 'rollup-plugin-sizes';
import autoExternal from 'rollup-plugin-auto-external';
import { sizeSnapshot } from 'rollup-plugin-size-snapshot';

export default {
  input: ['src/index.ts'],
  output: {
    sourcemap: true,
    dir: 'dist',
    format: 'cjs',
  },
  plugins: [
    eslint({ fix: true }),
    del({ targets: 'dist/*' }),
    auto(),
    // Allow node_modules resolution, so you can use 'external' to control
    // which external modules to include in the bundle
    // https://github.com/rollup/rollup-plugin-node-resolve#usage
    resolve(),
    autoExternal(),
    postcss({ extract: true }),
    // builtins({ crypto: true }),
    // Compile TypeScript files
    typescript({ useTsconfigDeclarationDir: true }),
    // Allow bundling cjs modules (unlike webpack, rollup doesn't understand cjs)
    commonjs(),
    cleanup({ extensions: ['ts', 'tsx'] }),
    strip({ include: ['**/*.ts', '**/*.tsx'] }),
    // Resolve source maps to the original source
    sourceMaps(),
    sizes({ details: true }),
    sizeSnapshot(),
  ],
};
