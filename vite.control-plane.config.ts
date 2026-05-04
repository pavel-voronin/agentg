import { fileURLToPath } from 'node:url';

import tailwindcss from '@tailwindcss/vite';
import vue from '@vitejs/plugin-vue';
import { defineConfig } from 'vite';

const projectRoot = fileURLToPath(new URL('.', import.meta.url));
const controlPlaneHost = process.env.CONTROL_PLANE_HOST ?? '127.0.0.1';
const controlPlanePort = parsePort(process.env.CONTROL_PLANE_PORT, 8789);
const controlPlaneUiHost = process.env.CONTROL_PLANE_UI_HOST ?? '127.0.0.1';
const controlPlaneUiPort = parsePort(process.env.CONTROL_PLANE_UI_PORT, 8790);

export default defineConfig({
  build: {
    emptyOutDir: true,
    outDir: `${projectRoot}dist-control-plane`
  },
  plugins: [vue(), tailwindcss()],
  root: 'src/edges/control-plane/client',
  server: {
    host: controlPlaneUiHost,
    port: controlPlaneUiPort,
    proxy: {
      '/ws': {
        target: `http://${proxyHost(controlPlaneHost)}:${String(controlPlanePort)}`,
        ws: true
      }
    },
    strictPort: true
  }
});

function parsePort(value: string | undefined, defaultValue: number): number {
  if (value === undefined || value.length === 0) {
    return defaultValue;
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new Error(`Port must be a positive integer: ${value}`);
  }
  return parsed;
}

function proxyHost(host: string): string {
  return host === '0.0.0.0' || host === '::' ? '127.0.0.1' : host;
}
