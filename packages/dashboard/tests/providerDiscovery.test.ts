import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { discoverProviders } from '../src/discovery/providerDiscovery.js';

describe('dashboard provider discovery', () => {
  it('skips disabled module providers', () => {
    const root = mkdtempSync(join(tmpdir(), 'agentg-dashboard-'));
    writeFileSync(
      join(root, 'package.json'),
      JSON.stringify({
        workspaces: ['packages/*']
      })
    );
    createDashboardProvider(root, 'dashboard');
    createDashboardProvider(root, 'telemetry');

    expect(
      discoverProviders(root, {
        disabledModuleNames: ['telemetry']
      }).map((provider) => provider.moduleName)
    ).toEqual(['dashboard']);
  });
});

function createDashboardProvider(root: string, moduleName: string): void {
  const directory = join(root, 'packages', moduleName, 'dashboard');
  mkdirSync(directory, { recursive: true });
  writeFileSync(join(directory, 'dashboard.ts'), 'export const dashboard = { contents: [] };');
}
