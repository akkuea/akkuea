/// <reference types="vitest" />
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [
    react({
      jsxRuntime: 'automatic',
      jsxImportSource: 'react',
    }),
  ],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setupTests.ts'],
    globals: true,
    css: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'html'],
      exclude: [
        'node_modules/',
        'src/test/',
        '**/*.d.ts',
        '**/*.config.*',
        '**/coverage/**',
        '**/dist/**',
        '**/.next/**',
        '**/build/**',
        '**/*.test.*',
        '**/*.spec.*',
      ],
    },
    include: [
      'src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}',
      'src/**/__tests__/**/*.{js,mjs,cjs,ts,mts,cts,jsx,tsx}',
    ],
    exclude: ['node_modules/', 'dist/', '.next/', 'build/', 'coverage/'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      'next/navigation': path.resolve(__dirname, './src/test/mocks/next-navigation.ts'),
      'next/image': path.resolve(__dirname, './src/test/mocks/next-image.tsx'),
      'next/link': path.resolve(__dirname, './src/test/mocks/next-link.tsx'),
    },
    conditions: ['development', 'browser'],
  },
});
