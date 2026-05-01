import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  base: './',
  plugins: [react({ jsxImportSource: '@linzight/i18n-jsx' })],
  resolve: {
    alias: {
      '@linzight/i18n-jsx': fileURLToPath(new URL('./src/i18n', import.meta.url))
    }
  },
  server: {
    port: 5173
  }
});
