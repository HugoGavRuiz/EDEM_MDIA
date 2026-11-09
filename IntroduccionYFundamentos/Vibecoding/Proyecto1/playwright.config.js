import { defineConfig, devices } from '@playwright/test';

const PUERTO = 5174; // distinto del 5173 del desarrollo, para no chocar con él

export default defineConfig({
  testDir: 'e2e',
  webServer: {
    command: `npm run dev -- --port ${PUERTO} --strictPort`,
    url: `http://localhost:${PUERTO}`,
    reuseExistingServer: false,
  },
  use: { baseURL: `http://localhost:${PUERTO}` },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
