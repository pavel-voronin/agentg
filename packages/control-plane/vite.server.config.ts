import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    emptyOutDir: true,
    outDir: 'dist-server',
    ssr: 'src/server/main.ts',
    target: 'node24',
    rollupOptions: {
      output: {
        entryFileNames: 'main.js'
      }
    }
  }
});
