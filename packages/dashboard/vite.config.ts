import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

import tailwindcss from '@tailwindcss/vite';
import vue from '@vitejs/plugin-vue';
import Icons from 'unplugin-icons/vite';
import { defineConfig, type Plugin, type UserConfig } from 'vite';

import { dashboardProviderDiscovery } from './src/discovery/providerPlugin.js';

const browserSharedModules = new Set(['vue']);
const browserSharedModuleUrls = new Map([['vue', '/dashboard/runtime/vue.js']]);
const nodeRequire = createRequire(import.meta.url);
const vueRuntimeFilePath = nodeRequire.resolve('vue/dist/vue.runtime.esm-browser.js');
const mediaServerUrl = safeMediaServerUrl(
  process.env.TELEGRAM_FILES_URL ?? 'http://127.0.0.1:8790'
);

export default defineConfig(({ command }): UserConfig => {
  const devServer = command === 'serve';
  return {
    build: {
      emptyOutDir: true,
      outDir: 'dist',
      rollupOptions: {
        external: [...browserSharedModules]
      }
    },
    optimizeDeps: {
      exclude: devServer ? ['pinia', ...browserSharedModules] : [...browserSharedModules]
    },
    plugins: [
      dashboardProviderDiscovery(),
      ...(devServer ? [rewriteBrowserSharedModuleImports()] : [externalizeBrowserSharedModules()]),
      vue(),
      Icons({ autoInstall: false, compiler: 'vue3' }),
      tailwindcss()
    ],
    preview: {
      host: '127.0.0.1',
      port: 8788
    },
    server: {
      host: '127.0.0.1',
      port: 8788,
      proxy: {
        '/dashboard': {
          target: 'http://127.0.0.1:8789'
        },
        '/telegram-files': {
          target: mediaServerUrl
        },
        '/ws': {
          target: 'ws://127.0.0.1:8789',
          ws: true
        }
      },
      warmup: {
        clientFiles: ['./src/main.ts']
      }
    }
  };
});

function externalizeBrowserSharedModules(): Plugin {
  return {
    name: 'externalize-browser-shared-modules',
    resolveId(source) {
      return browserSharedModules.has(source) ? { external: true, id: source } : null;
    }
  };
}

function rewriteBrowserSharedModuleImports(): Plugin {
  return {
    enforce: 'post',
    load(id) {
      return isBrowserSharedModuleUrl(id) ? readFileSync(vueRuntimeFilePath, 'utf8') : null;
    },
    name: 'rewrite-browser-shared-module-imports',
    resolveId(source) {
      return isBrowserSharedModuleUrl(source) ? source : null;
    },
    transform(code) {
      let updated = code;
      for (const [moduleName, moduleUrl] of browserSharedModuleUrls) {
        updated = rewriteModuleImport(updated, moduleName, moduleUrl);
      }
      return updated === code ? null : { code: updated, map: null };
    }
  };
}

function isBrowserSharedModuleUrl(source: string): boolean {
  for (const moduleUrl of browserSharedModuleUrls.values()) {
    if (source === moduleUrl) {
      return true;
    }
  }
  return false;
}

function rewriteModuleImport(code: string, moduleName: string, moduleUrl: string): string {
  const escapedModuleName = escapeRegExp(moduleName);
  return code
    .replace(
      new RegExp(`\\bfrom\\s*(['"])${escapedModuleName}\\1`, 'g'),
      (_match, quote: string) => `from ${quote}${moduleUrl}${quote}`
    )
    .replace(
      new RegExp(`\\bimport\\s*\\(\\s*(['"])${escapedModuleName}\\1\\s*\\)`, 'g'),
      (_match, quote: string) => `import(${quote}${moduleUrl}${quote})`
    );
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function safeMediaServerUrl(value: string): string {
  const url = new URL(value);
  if (
    (url.protocol !== 'http:' && url.protocol !== 'https:') ||
    url.username.length > 0 ||
    url.password.length > 0 ||
    url.pathname !== '/' ||
    url.search.length > 0 ||
    url.hash.length > 0
  ) {
    throw new Error('TELEGRAM_FILES_URL must be an HTTP(S) origin without credentials or path');
  }
  return value;
}
