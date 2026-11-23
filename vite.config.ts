/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import solid from 'vite-plugin-solid';

export default defineConfig({
  plugins: [solid()],
  worker: { format: 'es' },
  test: {
    environment: 'node',
    setupFiles: ['src/test/setup.ts'],
  },
});
