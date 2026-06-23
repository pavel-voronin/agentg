import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';

export type DiscoveredProvider = {
  entryFile: string;
  moduleName: string;
};

export type DiscoverProvidersOptions = {
  disabledModuleNames?: readonly string[] | undefined;
};

export function discoverProviders(
  rootDirectory = process.cwd(),
  options: DiscoverProvidersOptions = {}
): DiscoveredProvider[] {
  const root = workspaceRoot(rootDirectory);
  const disabledModuleNames = new Set(options.disabledModuleNames ?? []);
  return modulePackageDirectories(root)
    .flatMap((packageDirectory) => discoverModule(packageDirectory, disabledModuleNames))
    .sort((left, right) => left.moduleName.localeCompare(right.moduleName));
}

export function dashboardProviderEntryPattern(rootDirectory = process.cwd()): string {
  return join(workspaceRoot(rootDirectory), 'packages/*/dashboard/dashboard.ts');
}

function discoverModule(
  packageDirectory: string,
  disabledModuleNames: ReadonlySet<string>
): DiscoveredProvider[] {
  const moduleName = basename(packageDirectory);
  if (disabledModuleNames.has(moduleName)) {
    return [];
  }

  const entryFile = join(packageDirectory, 'dashboard/dashboard.ts');
  if (!existsSync(entryFile)) {
    return [];
  }

  return [
    {
      entryFile,
      moduleName
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
