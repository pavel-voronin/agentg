import { fileURLToPath } from 'node:url';

import tailwindcss from '@tailwindcss/vite';
import vue from '@vitejs/plugin-vue';
import { defineConfig } from 'vite';

const entry = (path: string): string => fileURLToPath(new URL(path, import.meta.url));

export default defineConfig({
  build: {
    cssCodeSplit: false,
    emptyOutDir: true,
    lib: {
      cssFileName: 'style',
      entry: {
        'dashboard-chats': entry('./src/control-plane/TelegramDashboardChatsContent.vue'),
        status: entry('./src/control-plane/TelegramStatusContent.vue'),
        workspace: entry('./src/control-plane/TelegramWorkspaceContent.vue')
      },
      formats: ['es']
    },
    outDir: 'dist-control-plane',
    rollupOptions: {
      external: ['vue'],
      output: {
        assetFileNames: 'assets/[name][extname]',
        chunkFileNames: 'chunks/[name]-[hash].js',
        entryFileNames: '[name].js'
      }
    }
  },
  plugins: [vue(), tailwindcss()]
});
