import { fileURLToPath } from 'node:url';

import tailwindcss from '@tailwindcss/vite';
import vue from '@vitejs/plugin-vue';
import { defineConfig } from 'vite';

const projectRoot = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  build: {
    emptyOutDir: true,
    outDir: `${projectRoot}dist-control-plane`
  },
  plugins: [vue(), tailwindcss()],
  root: 'src/edges/control-plane/client'
});
