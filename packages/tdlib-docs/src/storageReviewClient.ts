import type {
  StorageReviewEntryPatch,
  StorageReviewState,
  StorageSchemaTablePatch
} from './storageReviewTypes.js';

const storageReviewApiPath = '/api/tdlib-storage-review';
const storageReviewUpdateEvent = 'tdlib-storage-review:update';

export async function fetchStorageReviewState(): Promise<StorageReviewState> {
  return readStorageReviewResponse(await fetch(storageReviewApiPath));
}

export async function updateStorageReviewEntry(
  typeName: string,
  patch: StorageReviewEntryPatch
): Promise<StorageReviewState> {
  return readStorageReviewResponse(
    await fetch(`${storageReviewApiPath}/entries/${encodeURIComponent(typeName)}`, {
      body: JSON.stringify(patch),
      headers: {
        'Content-Type': 'application/json'
      },
      method: 'PUT'
    })
  );
}

export async function updateStorageSchemaTable(
  tableName: string,
  patch: StorageSchemaTablePatch
): Promise<StorageReviewState> {
  return readStorageReviewResponse(
    await fetch(`${storageReviewApiPath}/tables/${encodeURIComponent(tableName)}`, {
      body: JSON.stringify(patch),
      headers: {
        'Content-Type': 'application/json'
      },
      method: 'PUT'
    })
  );
}

export function onStorageReviewStateUpdate(handler: (state: StorageReviewState) => void): void {
  import.meta.hot?.on(storageReviewUpdateEvent, handler);
}

async function readStorageReviewResponse(response: Response): Promise<StorageReviewState> {
  if (!response.ok) {
    throw new Error(await response.text());
  }

  return (await response.json()) as StorageReviewState;
}
