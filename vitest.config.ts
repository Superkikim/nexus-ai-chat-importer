import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./vitest.setup.ts'],
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'dist/',
        'src/**/*.test.ts',
        'src/tests/',
      ],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      // Use a lightweight stub for Obsidian so tests can import modules that
      // depend on the Obsidian API (Vault, App, requestUrl, etc.) without
      // requiring a real Obsidian runtime.
      'obsidian': path.resolve(__dirname, './src/obsidian-mock.ts'),
    },
  },
});

