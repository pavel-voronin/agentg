import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    emptyOutDir: true,
    outDir: 'dist',
    ssr: 'src/main.ts',
    target: 'node24',
    rollupOptions: {
      output: {
        entryFileNames: 'main.js'
      }
    }
  }
});
