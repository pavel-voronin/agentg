import { createHash } from 'node:crypto';
import { mkdirSync, renameSync, watch, writeFileSync, type FSWatcher } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

export const CONTROL_PLANE_ASSET_VERSION_FILE = 'control-plane-assets.json';

export type ControlPlaneAssetVersionSubscription = {
  close(): void;
};

export type ControlPlaneAssetVersions = {
  assets: Readonly<Record<string, string>>;
  version: string;
};

type ControlPlaneAssetVersionFile = {
  assets: Record<string, string>;
  version: string;
};

type ControlPlaneAssetVersionWatcherOptions = {
  initialVersion: ControlPlaneAssetVersions;
  onError?(error: Error): void;
  onVersion(version: ControlPlaneAssetVersions): void | Promise<void>;
  rootDir: string;
};

const CONTROL_PLANE_ASSET_VERSION_PATTERN = /^[A-Za-z0-9._-]+$/;

export function createControlPlaneAssetVersion(
  assetVersions: Readonly<Record<string, string>>
): string {
  const hash = createHash('sha256');
  for (const [assetPath, assetVersion] of Object.entries(assetVersions).sort(compareEntries)) {
    hash.update(assetPath);
    hash.update('\0');
    hash.update(assetVersion);
    hash.update('\0');
  }
  return hash.digest('hex').slice(0, 16);
}

export function controlPlaneAssetVersionsFromBundle(
  bundle: Readonly<Record<string, unknown>>
): Record<string, string> {
  return Object.fromEntries(
    Object.entries(bundle).map(([fileName, output]) => [fileName, assetVersionFromOutput(output)])
  );
}

export async function readControlPlaneAssetVersions(
  rootDir: string
): Promise<ControlPlaneAssetVersions> {
  const payload = JSON.parse(
    await readFile(controlPlaneAssetVersionFilePath(rootDir), 'utf8')
  ) as unknown;
  if (!isControlPlaneAssetVersionFile(payload)) {
    throw new Error(`Control Plane asset version file is invalid: ${rootDir}`);
  }
  return {
    assets: payload.assets,
    version: payload.version
  };
}

export function writeControlPlaneAssetVersion(
  rootDir: string,
  assetVersions: Readonly<Record<string, string>>
): ControlPlaneAssetVersions {
  const version = createControlPlaneAssetVersion(assetVersions);
  const payload = {
    assets: sortedRecord(assetVersions),
    version
  } satisfies ControlPlaneAssetVersionFile;
  mkdirSync(rootDir, { recursive: true });
  const versionFilePath = controlPlaneAssetVersionFilePath(rootDir);
  const temporaryVersionFilePath = `${versionFilePath}.tmp`;
  writeFileSync(temporaryVersionFilePath, `${JSON.stringify(payload)}\n`);
  renameSync(temporaryVersionFilePath, versionFilePath);
  return payload;
}

export function watchControlPlaneAssetVersion(
  options: ControlPlaneAssetVersionWatcherOptions
): ControlPlaneAssetVersionSubscription {
  let closed = false;
  let currentVersion = options.initialVersion.version;
  let pendingRead: ReturnType<typeof setTimeout> | null = null;
  const watcher = watch(options.rootDir, (_eventType, filename) => {
    if (filename?.toString() !== CONTROL_PLANE_ASSET_VERSION_FILE) {
      return;
    }
    scheduleRead();
  });

  function scheduleRead(): void {
    if (pendingRead !== null) {
      clearTimeout(pendingRead);
    }
    pendingRead = setTimeout(() => {
      pendingRead = null;
      void readNextVersion();
    }, 50);
  }

  async function readNextVersion(): Promise<void> {
    if (closed) {
      return;
    }
    try {
      const nextVersion = await readControlPlaneAssetVersions(options.rootDir);
      if (nextVersion.version === currentVersion) {
        return;
      }
      currentVersion = nextVersion.version;
      await options.onVersion(nextVersion);
    } catch (error) {
      const normalizedError = error instanceof Error ? error : new Error(String(error));
      if (isNotFoundError(normalizedError)) {
        return;
      }
      options.onError?.(normalizedError);
      console.warn(
        JSON.stringify({
          error: normalizedError.message,
          event: 'control_plane.asset_version_watch_failed',
          rootDir: options.rootDir
        })
      );
    }
  }

  return {
    close() {
      closed = true;
      if (pendingRead !== null) {
        clearTimeout(pendingRead);
        pendingRead = null;
      }
      closeWatcher(watcher);
    }
  };
}

export function controlPlaneAssetVersionFilePath(rootDir: string): string {
  return join(rootDir, CONTROL_PLANE_ASSET_VERSION_FILE);
}

function isControlPlaneAssetVersionFile(value: unknown): value is ControlPlaneAssetVersionFile {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }
  const version = (value as Record<string, unknown>).version;
  const assets = (value as Record<string, unknown>).assets;
  return (
    typeof version === 'string' &&
    version.length > 0 &&
    CONTROL_PLANE_ASSET_VERSION_PATTERN.test(version) &&
    isAssetVersionsRecord(assets)
  );
}

function isAssetVersionsRecord(value: unknown): value is Record<string, string> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }
  return Object.entries(value).every(
    ([assetPath, assetVersion]) =>
      safeAssetPath(assetPath) &&
      typeof assetVersion === 'string' &&
      assetVersion.length > 0 &&
      CONTROL_PLANE_ASSET_VERSION_PATTERN.test(assetVersion)
  );
}

function safeAssetPath(assetPath: string): boolean {
  return (
    assetPath.length > 0 &&
    !assetPath.startsWith('/') &&
    !assetPath.includes('..') &&
    !assetPath.includes('\\')
  );
}

function sortedRecord(input: Readonly<Record<string, string>>): Record<string, string> {
  return Object.fromEntries(Object.entries(input).sort(compareEntries));
}

function compareEntries(left: readonly [string, string], right: readonly [string, string]): number {
  return left[0].localeCompare(right[0]);
}

function assetVersionFromOutput(output: unknown): string {
  if (isChunkOutput(output)) {
    return contentHash(output.code);
  }
  if (isAssetOutput(output)) {
    return contentHash(output.source);
  }
  return contentHash(JSON.stringify(output));
}

function isChunkOutput(output: unknown): output is { code: string; type: 'chunk' } {
  return (
    typeof output === 'object' &&
    output !== null &&
    (output as { type?: unknown }).type === 'chunk' &&
    typeof (output as { code?: unknown }).code === 'string'
  );
}

function isAssetOutput(output: unknown): output is { source: string | Uint8Array; type: 'asset' } {
  return (
    typeof output === 'object' &&
    output !== null &&
    (output as { type?: unknown }).type === 'asset' &&
    (typeof (output as { source?: unknown }).source === 'string' ||
      (output as { source?: unknown }).source instanceof Uint8Array)
  );
}

function contentHash(content: string | Uint8Array): string {
  return createHash('sha256').update(content).digest('hex').slice(0, 16);
}

function closeWatcher(watcher: FSWatcher): void {
  try {
    watcher.close();
  } catch (error) {
    console.warn(
      JSON.stringify({
        error: error instanceof Error ? error.message : String(error),
        event: 'control_plane.asset_version_watcher_close_failed'
      })
    );
  }
}

function isNotFoundError(error: Error): boolean {
  return 'code' in error && (error as { code?: unknown }).code === 'ENOENT';
}
