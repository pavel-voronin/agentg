import { fileURLToPath } from 'node:url';

import type { Plugin } from 'vite';

import {
  controlPlaneProviderEntryPattern,
  discoverProviders,
  type DiscoveredProvider
} from './providerDiscovery.js';

const virtualModuleId = 'virtual:control-plane/providers';
const resolvedVirtualModuleId = `\0${virtualModuleId}`;
const shellProviderFile = fileURLToPath(
  new URL('../composition/content/control-plane/provider.ts', import.meta.url)
);

export function controlPlaneProviderDiscovery(): Plugin {
  let providers: DiscoveredProvider[] = [];

  return {
    buildStart() {
      providers = discoverProviders();
      for (const provider of providers) {
        this.addWatchFile(provider.entryFile);
      }
    },
    configureServer(server) {
      server.watcher.add(controlPlaneProviderEntryPattern());
      server.watcher.on('add', reloadIfControlPlaneEntry);
      server.watcher.on('unlink', reloadIfControlPlaneEntry);

      function reloadIfControlPlaneEntry(path: string): void {
        const normalizedPath = path.split('\\').join('/');
        if (!normalizedPath.endsWith('/control-plane/controlPlane.ts')) {
          return;
        }
        const module = server.moduleGraph.getModuleById(resolvedVirtualModuleId);
        if (module !== undefined) {
          server.moduleGraph.invalidateModule(module);
        }
        server.ws.send({ type: 'full-reload' });
      }
    },
    load(id) {
      return id === resolvedVirtualModuleId ? providerModuleCode(providers) : null;
    },
    name: 'control-plane-provider-discovery',
    resolveId(id) {
      return id === virtualModuleId ? resolvedVirtualModuleId : null;
    }
  };
}

function providerModuleCode(providers: readonly DiscoveredProvider[]): string {
  const imports: string[] = [
    `import { controlPlaneContentProvider } from ${JSON.stringify(viteFilePath(shellProviderFile))};`
  ];
  const providerObjects = ['controlPlaneContentProvider'];
  let providerIndex = 0;

  for (const provider of providers) {
    const providerName = `moduleProvider${String(providerIndex)}`;
    providerIndex += 1;
    imports.push(
      `import { controlPlane as ${providerName} } from ${JSON.stringify(viteFilePath(provider.entryFile))};`
    );
    providerObjects.push(`{
      contents: ${providerName}.contents,
      domainId: ${JSON.stringify(provider.moduleName)}
    }`);
  }

  return `${imports.join('\n')}

export const providers = [${providerObjects.join(',')}];
`;
}

function viteFilePath(path: string): string {
  return `/@fs/${path}`;
}
