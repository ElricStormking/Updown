import { defineConfig } from 'vite';

export default defineConfig({
  publicDir: 'assets',
  server: {
    port: 3000,
    host: '0.0.0.0',
  },
  preview: {
    port: 3000,
  },
});

