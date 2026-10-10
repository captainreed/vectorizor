import { defineConfig } from '@playwright/test';

// Own port and a throwaway database, so tests never touch a running dev server's accounts.
export default defineConfig({
  testDir: './tests/e2e',
  timeout: 120000,
  use: { baseURL: 'http://localhost:5174' },
  webServer: {
    command: 'rm -f test-results/e2e.db* && VECTORIZOR_DB=test-results/e2e.db npm run dev -- --port 5174 --strictPort',
    url: 'http://localhost:5174',
    reuseExistingServer: false,
  },
});
