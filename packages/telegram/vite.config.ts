import vue from '@vitejs/plugin-vue';
import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    emptyOutDir: true,
    outDir: 'dist',
    ssr: 'src/app/main.ts',
    target: 'node24',
    rollupOptions: {
      output: {
        entryFileNames: 'main.js'
      }
    }
  },
  plugins: [vue()]
});
