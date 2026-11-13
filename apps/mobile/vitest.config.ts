import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';
export default defineConfig({
  resolve: { alias: { 'react-native': fileURLToPath(new URL('./tests/nativeMock.ts', import.meta.url)) } },
  oxc: { jsx: { runtime: 'automatic' } },
  test: { environment: 'node', setupFiles: ['./tests/setup.ts'] },
});
