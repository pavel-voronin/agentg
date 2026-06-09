import { fileURLToPath } from 'node:url';

import type { Plugin } from 'vite';

import {
  dashboardProviderEntryPattern,
  discoverProviders,
  type DiscoveredProvider
} from './providerDiscovery.js';

const virtualModuleId = 'virtual:dashboard/providers';
const resolvedVirtualModuleId = `\0${virtualModuleId}`;
const shellProviderFile = fileURLToPath(
  new URL('../composition/content/dashboard/provider.ts', import.meta.url)
);

export function dashboardProviderDiscovery(): Plugin {
  let providers: DiscoveredProvider[] = [];

  return {
    buildStart() {
      providers = discoverProviders();
      for (const provider of providers) {
        this.addWatchFile(provider.entryFile);
      }
    },
    configureServer(server) {
      server.watcher.add(dashboardProviderEntryPattern());
      server.watcher.on('add', reloadIfDashboardEntry);
      server.watcher.on('unlink', reloadIfDashboardEntry);

      function reloadIfDashboardEntry(path: string): void {
        const normalizedPath = path.split('\\').join('/');
        if (!normalizedPath.endsWith('/dashboard/dashboard.ts')) {
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
    name: 'dashboard-provider-discovery',
    resolveId(id) {
      return id === virtualModuleId ? resolvedVirtualModuleId : null;
    }
  };
}

function providerModuleCode(providers: readonly DiscoveredProvider[]): string {
  const imports: string[] = [
    `import { dashboardContentProvider } from ${JSON.stringify(viteFilePath(shellProviderFile))};`
  ];
  const providerObjects = ['dashboardContentProvider'];
  let providerIndex = 0;

  for (const provider of providers) {
    const providerName = `moduleProvider${String(providerIndex)}`;
    providerIndex += 1;
    imports.push(
      `import { dashboard as ${providerName} } from ${JSON.stringify(viteFilePath(provider.entryFile))};`
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
