import { defineConfig, devices } from '@playwright/test';

// Puertos distintos del 5173 del desarrollo, para no chocar con él.
const PUERTO = 5174; // app SIN API: el botón del tipo medio no existe (VITE_API_URL vacía)
const PUERTO_CON_API = 5175; // app con una API ficticia que estas pruebas simulan con page.route
const CON_API = /(tipo-medio|asesor(-[a-z]+)?)\.spec\.js/;

// Las variables del entorno pisan al .env: así las pruebas no dependen de si el backend real está encendido.
const servidor = (puerto, apiUrl) => ({
  command: `npm run dev -- --port ${puerto} --strictPort`,
  url: `http://localhost:${puerto}`,
  reuseExistingServer: false,
  env: { VITE_API_URL: apiUrl },
});

export default defineConfig({
  testDir: 'e2e',
  webServer: [servidor(PUERTO, ''), servidor(PUERTO_CON_API, 'http://api.test')],
  use: { baseURL: `http://localhost:${PUERTO}` },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      testIgnore: CON_API,
    },
    {
      name: 'con-api',
      use: { ...devices['Desktop Chrome'], baseURL: `http://localhost:${PUERTO_CON_API}` },
      testMatch: CON_API,
    },
  ],
});
