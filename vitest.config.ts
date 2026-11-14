import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  oxc: {
    jsx: {
      runtime: 'automatic',
    },
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.{test,spec}.ts', 'src/**/*.{test,spec}.ts'],
    exclude: ['node_modules', '.next', 'dist', 'tests/e2e/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      thresholds: {
        lines: 75,
        statements: 75,
      },
    },
  },
  ssr: {
    noExternal: ['flags'],
  },
  resolve: {
    alias: [
      { find: 'next/headers', replacement: require.resolve('next/headers') },
      { find: '@', replacement: path.resolve(__dirname, './src') },
    ],
  },
});

