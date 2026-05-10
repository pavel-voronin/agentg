import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import type { EventBus } from '@agentg/events/bus';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { TelegramDatabase } from '../src/database.js';
import type { StoredCanonicalFile, TelegramFileDownloadRow } from '../src/telegram-file-store.js';

describe('Telegram file download worker lifecycle', () => {
  const temporaryRoots: string[] = [];

  afterEach(async () => {
    vi.doUnmock('../src/telegram-file-store.js');
    vi.resetModules();
    await Promise.all(
      temporaryRoots.splice(0).map((path) => rm(path, { force: true, recursive: true }))
    );
  });

  it('canonicalizes completed updateFile assets and removes message downloads from TDLib', async () => {
    const root = await createTemporaryRoot(temporaryRoots);
    const sourcePath = join(root, 'source-photo.jpg');
    await writeFile(sourcePath, 'telegram photo');
    const store = createStoreMocks();
    store.rows.set(
      'asset-message',
      downloadRow({
        assetKey: 'asset-message',
        latestTdlibFileId: 123,
        transport: {
          chatId: -10042,
          kind: 'message',
          messageId: 777
        }
      })
    );
    const client = createClient();
    const { startTelegramFileDownloadWorker } = await loadWorker(store);

    const worker = startTelegramFileDownloadWorker({
      client,
      database: fakeDatabase(),
      eventBus: fakeEventBus(),
      filesDirectory: root,
      intervalMs: 60_000,
      maxFilesPerTick: 1
    });
    worker.enqueueCompletedFile({
      assetKey: 'asset-message',
      localPath: sourcePath,
      tdlibFileId: 123
    });

    await waitUntil(() => store.markTelegramFileDownloadReady.mock.calls.length === 1);
    await waitUntil(() =>
      client.invoke.mock.calls.some(([request]) => request._ === 'removeFileFromDownloads')
    );
    worker.close();

    expect(store.markTelegramFileDownloadReady.mock.calls[0]?.[1]).toBe('asset-message');
    const stored = readyStoredFile(store, 0);
    expect(stored.byteSize).toBe('telegram photo'.length);
    expect(stored.relativePath).toMatch(/^agentg-media\/[a-f0-9]{64}\.jpg$/);
    expect(client.invoke).toHaveBeenCalledWith(
      {
        _: 'removeFileFromDownloads',
        delete_from_cache: true,
        file_id: 123
      },
      {
        priority: 8
      }
    );
  });

  it('does not run overlapping ticks when completed files arrive during canonicalization', async () => {
    const root = await createTemporaryRoot(temporaryRoots);
    const firstSource = join(root, 'first.jpg');
    const secondSource = join(root, 'second.jpg');
    await writeFile(firstSource, 'first');
    await writeFile(secondSource, 'second');
    const firstReady = createDeferred<null>();
    const store = createStoreMocks();
    store.rows.set('asset-a', downloadRow({ assetKey: 'asset-a', latestTdlibFileId: 1 }));
    store.rows.set('asset-b', downloadRow({ assetKey: 'asset-b', latestTdlibFileId: 2 }));
    store.markTelegramFileDownloadReady.mockImplementation(
      async (_database: unknown, assetKey: string) => {
        if (assetKey === 'asset-a') {
          await firstReady.promise;
        }
      }
    );
    const { startTelegramFileDownloadWorker } = await loadWorker(store);

    const worker = startTelegramFileDownloadWorker({
      client: createClient(),
      database: fakeDatabase(),
      eventBus: fakeEventBus(),
      filesDirectory: root,
      intervalMs: 60_000,
      maxFilesPerTick: 1
    });
    worker.enqueueCompletedFile({
      assetKey: 'asset-a',
      localPath: firstSource,
      tdlibFileId: 1
    });
    await waitUntil(() =>
      store.markTelegramFileDownloadReady.mock.calls.some(([, assetKey]) => assetKey === 'asset-a')
    );

    worker.enqueueCompletedFile({
      assetKey: 'asset-b',
      localPath: secondSource,
      tdlibFileId: 2
    });
    await delay(30);

    expect(
      store.markTelegramFileDownloadReady.mock.calls.some(([, assetKey]) => assetKey === 'asset-b')
    ).toBe(false);

    firstReady.resolve(null);
    await waitUntil(() =>
      store.markTelegramFileDownloadReady.mock.calls.some(([, assetKey]) => assetKey === 'asset-b')
    );
    worker.close();
  });

  it('reconciles stale downloads through getFile before dispatching a new TDLib download', async () => {
    const root = await createTemporaryRoot(temporaryRoots);
    const sourcePath = join(root, 'avatar.webp');
    await writeFile(sourcePath, 'avatar');
    const staleRow = downloadRow({
      assetKey: 'asset-stale',
      latestTdlibFileId: 222,
      transport: {
        kind: 'file'
      }
    });
    const store = createStoreMocks();
    store.rows.set('asset-stale', staleRow);
    store.readStaleTelegramFileDownloadRows.mockResolvedValue([staleRow]);
    const client = createClient((request) => {
      if (request._ === 'getFile') {
        return Promise.resolve({
          _: 'file',
          id: 222,
          local: {
            downloaded_size: 'avatar'.length,
            is_downloading_completed: true,
            path: sourcePath
          }
        });
      }
      return Promise.resolve({ _: 'ok' });
    });
    const { processNextQueuedFile } = await loadWorker(store);

    await expect(
      processNextQueuedFile({
        client,
        database: fakeDatabase(),
        eventBus: fakeEventBus(),
        filesDirectory: root
      })
    ).resolves.toBe(false);

    expect(client.invoke.mock.calls.map(([request]) => request._)).toEqual([
      'getFile',
      'deleteFile'
    ]);
    expect(store.markTelegramFileDownloadReady.mock.calls[0]?.[1]).toBe('asset-stale');
    const stored = readyStoredFile(store, 0);
    expect(stored.byteSize).toBe('avatar'.length);
    expect(stored.relativePath).toMatch(/^agentg-media\/[a-f0-9]{64}\.jpg$/);
    expect(store.markTelegramFileDownloadDispatched).not.toHaveBeenCalled();
  });

  it('ignores completed TDLib events for stale file ids', async () => {
    const root = await createTemporaryRoot(temporaryRoots);
    const sourcePath = join(root, 'stale.jpg');
    await writeFile(sourcePath, 'stale');
    const store = createStoreMocks();
    store.rows.set(
      'asset-stale-event',
      downloadRow({
        assetKey: 'asset-stale-event',
        latestTdlibFileId: 10
      })
    );
    const client = createClient();
    const { canonicalizeCompletedTelegramFile } = await loadWorker(store);

    await canonicalizeCompletedTelegramFile(
      {
        client,
        database: fakeDatabase(),
        eventBus: fakeEventBus(),
        filesDirectory: root
      },
      {
        assetKey: 'asset-stale-event',
        localPath: sourcePath,
        tdlibFileId: 11
      }
    );

    expect(store.markTelegramFileDownloadReady).not.toHaveBeenCalled();
    expect(client.invoke).not.toHaveBeenCalled();
  });
});

type StoreMocks = ReturnType<typeof createStoreMocks>;

function createStoreMocks() {
  const rows = new Map<string, TelegramFileDownloadRow>();
  return {
    claimNextQueuedTelegramFileDownload: vi.fn(() =>
      Promise.resolve(null as TelegramFileDownloadRow | null)
    ),
    markTelegramFileDownloadDispatched: vi.fn(() => Promise.resolve()),
    markTelegramFileDownloadFailed: vi.fn(() => Promise.resolve()),
    markTelegramFileDownloadReady: vi.fn(
      (_database: unknown, _assetKey: string, _stored: StoredCanonicalFile) => {
        void _database;
        void _assetKey;
        void _stored;
        return Promise.resolve();
      }
    ),
    readStaleTelegramFileDownloadRows: vi.fn(() =>
      Promise.resolve([] as TelegramFileDownloadRow[])
    ),
    readTelegramFileDownloadRow: vi.fn((_database: unknown, assetKey: string) => {
      void _database;
      return Promise.resolve(rows.get(assetKey) ?? null);
    }),
    readTelegramFileOwnersForAsset: vi.fn(() => Promise.resolve([])),
    readTelegramFileQueueStats: vi.fn(() =>
      Promise.resolve({
        downloadingCount: 0,
        failedCount: 0,
        knownCount: 0,
        knownDownloadedBytes: 0,
        knownRemainingBytes: 0,
        knownTotalBytes: 0,
        queuedCount: 0,
        readyCount: 0,
        remainingCount: 0,
        totalCount: 0,
        unknownRemainingCount: 0
      })
    ),
    rows
  };
}

async function loadWorker(store: StoreMocks) {
  vi.resetModules();
  vi.doMock('../src/telegram-file-store.js', () => store);
  return import('../src/telegram-file-worker.js');
}

function createClient(
  invoke: (request: Record<string, unknown>) => Promise<unknown> = () =>
    Promise.resolve({ _: 'ok' })
) {
  return {
    getQueueStats: vi.fn(() => ({
      highestPendingPriority: null,
      pendingCount: 0,
      runningCount: 0
    })),
    invoke: vi.fn(invoke)
  };
}

function downloadRow(input: {
  assetKey: string;
  latestTdlibFileId: number;
  transport?: TelegramFileDownloadRow['transport'];
}): TelegramFileDownloadRow {
  return {
    assetKey: input.assetKey,
    byteSize: null,
    fileName: 'file.jpg',
    latestTdlibFileId: input.latestTdlibFileId,
    mimeType: 'image/jpeg',
    priority: 16,
    transport: input.transport ?? {
      kind: 'file'
    }
  };
}

function fakeDatabase(): TelegramDatabase {
  return {} as TelegramDatabase;
}

function fakeEventBus(): EventBus {
  return {
    close() {
      return Promise.resolve();
    },
    publish: vi.fn(),
    subscribe() {
      return {
        unsubscribe() {
          return;
        }
      };
    }
  };
}

function readyStoredFile(store: StoreMocks, index: number): StoredCanonicalFile {
  const call = store.markTelegramFileDownloadReady.mock.calls[index];
  if (call === undefined) {
    throw new Error(`Missing ready call at index ${String(index)}`);
  }
  return call[2];
}

async function createTemporaryRoot(roots: string[]): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'agentg-telegram-file-worker-'));
  roots.push(root);
  return root;
}

function createDeferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });
  return {
    promise,
    reject,
    resolve
  };
}

async function waitUntil(condition: () => boolean): Promise<void> {
  const startedAt = Date.now();
  while (!condition()) {
    if (Date.now() - startedAt > 1000) {
      throw new Error('Timed out waiting for condition');
    }
    await delay(5);
  }
}

async function delay(milliseconds: number): Promise<void> {
  await new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}
