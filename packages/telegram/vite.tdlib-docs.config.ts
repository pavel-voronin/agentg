import { fileURLToPath } from 'node:url';

import tailwindcss from '@tailwindcss/vite';
import vue from '@vitejs/plugin-vue';
import Icons from 'unplugin-icons/vite';
import { defineConfig, type Plugin } from 'vite';

import { tdlibStorageReviewPlugin } from './src/tdlib-docs-server/storageReview.js';

const docsRoot = fileURLToPath(new URL('./src/tdlib-docs/', import.meta.url));
const outDir = fileURLToPath(new URL('./dist-tdlib-docs/', import.meta.url));
const storageReviewFile = fileURLToPath(
  new URL('./src/tdlib-docs/data/tdlib-storage-review.json', import.meta.url)
);

export default defineConfig({
  base: './',
  build: {
    assetsInlineLimit: Number.MAX_SAFE_INTEGER,
    cssCodeSplit: false,
    emptyOutDir: true,
    outDir,
    target: 'es2024'
  },
  plugins: [
    vue(),
    Icons({ autoInstall: false, compiler: 'vue3' }),
    tailwindcss(),
    tdlibStorageReviewPlugin(storageReviewFile),
    inlineSingleHtml()
  ],
  root: docsRoot
});

function inlineSingleHtml(): Plugin {
  return {
    enforce: 'post',
    generateBundle(_options, bundle) {
      const htmlAsset = bundle['index.html'];
      if (htmlAsset?.type !== 'asset') {
        return;
      }

      let html = sourceToString(htmlAsset.source);

      for (const [fileName, item] of Object.entries(bundle)) {
        if (fileName === 'index.html') {
          continue;
        }

        const pathPattern = assetPathPattern(fileName);
        if (item.type === 'chunk') {
          html = html.replace(
            new RegExp(`<script\\s+([^>]*?)src=["']${pathPattern}["']([^>]*)></script>`, 'g'),
            () =>
              `<script type="module">\n${item.code.replaceAll('</script', '<\\/script')}\n</script>`
          );
          Reflect.deleteProperty(bundle, fileName);
          continue;
        }

        if (fileName.endsWith('.css')) {
          html = html.replace(
            new RegExp(`<link\\s+([^>]*?)href=["']${pathPattern}["']([^>]*)>`, 'g'),
            () => `<style>\n${sourceToString(item.source)}\n</style>`
          );
          Reflect.deleteProperty(bundle, fileName);
          continue;
        }

        Reflect.deleteProperty(bundle, fileName);
      }

      htmlAsset.source = html;
    },
    name: 'tdlib-docs-inline-single-html'
  };
}

function assetPathPattern(fileName: string): string {
  return `(?:\\./)?${escapeRegExp(fileName)}`;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function sourceToString(source: string | Uint8Array): string {
  return typeof source === 'string' ? source : new TextDecoder().decode(source);
}
