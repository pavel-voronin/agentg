import tailwindcss from '@tailwindcss/vite';
import vue from '@vitejs/plugin-vue';
import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    emptyOutDir: true,
    outDir: 'dist'
  },
  plugins: [vue(), tailwindcss()],
  preview: {
    host: '127.0.0.1',
    port: 8788
  },
  server: {
    host: '127.0.0.1',
    port: 8788
  }
});
