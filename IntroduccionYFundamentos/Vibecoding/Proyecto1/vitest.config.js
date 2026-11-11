import { configDefaults, defineConfig } from 'vitest/config';

// Las pruebas de extremo a extremo (Playwright) viven en e2e/ y las ejecuta `npm run test:e2e`.
export default defineConfig({
  test: { exclude: [...configDefaults.exclude, 'e2e/**'] },
});
