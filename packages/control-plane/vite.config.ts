import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

import tailwindcss from '@tailwindcss/vite';
import vue from '@vitejs/plugin-vue';
import { defineConfig, type Plugin, type UserConfig } from 'vite';

const browserSharedModules = new Set(['vue']);
const browserSharedModuleUrls = new Map([['vue', '/control-plane/runtime/vue.js']]);
const nodeRequire = createRequire(import.meta.url);
const vueRuntimeFilePath = nodeRequire.resolve('vue/dist/vue.runtime.esm-browser.prod.js');

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
      ...(devServer ? [rewriteBrowserSharedModuleImports()] : [externalizeBrowserSharedModules()]),
      vue(),
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
        '/control-plane': {
          target: 'http://127.0.0.1:8789'
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
    name: 'rewrite-browser-shared-module-imports',
    load(id) {
      return isBrowserSharedModuleUrl(id) ? readFileSync(vueRuntimeFilePath, 'utf8') : null;
    },
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
