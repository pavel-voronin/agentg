import tailwindcss from '@tailwindcss/vite';
import vue from '@vitejs/plugin-vue';
import { defineConfig } from 'vite';

export default defineConfig({
  base: '/ui/',
  build: {
    emptyOutDir: true,
    outDir: '../../dist/ui'
  },
  plugins: [vue(), tailwindcss()],
  root: 'src/ui'
});
