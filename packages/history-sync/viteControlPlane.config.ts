import { fileURLToPath } from 'node:url';

import {
  controlPlaneAssetVersionsFromBundle,
  writeControlPlaneAssetVersion
} from '@agentg/infra/control-plane/assets';
import tailwindcss from '@tailwindcss/vite';
import vue from '@vitejs/plugin-vue';
import Icons from 'unplugin-icons/vite';
import { defineConfig, type Plugin } from 'vite';

const entry = (path: string): string => fileURLToPath(new URL(path, import.meta.url));
const outDir = 'dist-control-plane';
const outDirPath = fileURLToPath(new URL(`${outDir}/`, import.meta.url));

export default defineConfig({
  build: {
    cssCodeSplit: false,
    emptyOutDir: true,
    lib: {
      cssFileName: 'style',
      entry: {
        'dashboard-tile': entry('./src/control-plane/historySyncDashboardTileContent.vue'),
        workspace: entry('./src/control-plane/historySyncWorkspaceContent.vue')
      },
      formats: ['es']
    },
    outDir,
    rollupOptions: {
      external: ['vue'],
      output: {
        assetFileNames: 'assets/[name][extname]',
        chunkFileNames: 'chunks/[name]-[hash].js',
        entryFileNames: '[name].js'
      }
    }
  },
  plugins: [
    vue(),
    Icons({ autoInstall: false, compiler: 'vue3' }),
    tailwindcss(),
    controlPlaneAssetVersion()
  ]
});

function controlPlaneAssetVersion(): Plugin {
  return {
    name: 'history-sync-control-plane-asset-version',
    writeBundle(_options, bundle) {
      const assetVersions = writeControlPlaneAssetVersion(
        outDirPath,
        controlPlaneAssetVersionsFromBundle(bundle)
      );
      console.log(
        JSON.stringify({
          assets: Object.keys(assetVersions.assets).length,
          event: 'history-sync.control_plane_assets_built',
          version: assetVersions.version
        })
      );
    }
  };
}
