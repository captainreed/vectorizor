/// <reference types="vitest/config" />
import { defineConfig, type Connect, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { createApiApp } from './server/app';

/** Serves the sessions/accounts API (/api/*) from the same server as the app, in dev and preview. */
function vectorizorApi(): Plugin {
  const mount = (middlewares: Connect.Server) => {
    if (process.env.VITEST) return;
    middlewares.use(createApiApp({ dbPath: process.env.VECTORIZOR_DB ?? 'data/vectorizor.db' }));
  };
  return {
    name: 'vectorizor-api',
    configureServer: (server) => mount(server.middlewares),
    configurePreviewServer: (server) => mount(server.middlewares),
  };
}

export default defineConfig({
  plugins: [react(), vectorizorApi()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.test.{ts,tsx}'],
  },
});
