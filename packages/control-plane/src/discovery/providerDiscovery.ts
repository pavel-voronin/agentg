import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';

export type DiscoveredProvider = {
  entryFile: string;
  moduleName: string;
};

export function discoverProviders(rootDirectory = process.cwd()): DiscoveredProvider[] {
  const root = workspaceRoot(rootDirectory);
  return modulePackageDirectories(root)
    .flatMap((packageDirectory) => discoverModule(packageDirectory))
    .sort((left, right) => left.moduleName.localeCompare(right.moduleName));
}

export function controlPlaneProviderEntryPattern(rootDirectory = process.cwd()): string {
  return join(workspaceRoot(rootDirectory), 'packages/*/control-plane/controlPlane.ts');
}

function discoverModule(packageDirectory: string): DiscoveredProvider[] {
  const entryFile = join(packageDirectory, 'control-plane/controlPlane.ts');
  if (!existsSync(entryFile)) {
    return [];
  }

  return [
    {
      entryFile,
      moduleName: basename(packageDirectory)
    }
  ];
}

function modulePackageDirectories(rootDirectory: string): string[] {
  const packagesDirectory = join(rootDirectory, 'packages');
  if (!existsSync(packagesDirectory)) {
    return [];
  }

  return readdirSync(packagesDirectory, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => join(packagesDirectory, entry.name));
}

function workspaceRoot(startDirectory: string): string {
  let current = resolve(startDirectory);

  for (;;) {
    const packageJson = join(current, 'package.json');
    if (isWorkspacePackage(packageJson)) {
      return current;
    }

    const parent = dirname(current);
    if (parent === current) {
      return resolve(startDirectory);
    }
    current = parent;
  }
}

function isWorkspacePackage(packageJson: string): boolean {
  if (!existsSync(packageJson)) {
    return false;
  }

  const manifest = JSON.parse(readFileSync(packageJson, 'utf8')) as { workspaces?: unknown };
  return Array.isArray(manifest.workspaces);
}
