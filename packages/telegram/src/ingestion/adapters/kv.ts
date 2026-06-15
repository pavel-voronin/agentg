import type { JsonValue } from '@agentg/framework';

import type {
  DomainChange,
  KvEntryDeletedChange,
  KvEntrySavedChange
} from '../../domain/changes.js';
import { tdJsonValue } from '../../tdlib/shape.js';

type ChatList = {
  _: string;
  chat_folder_id?: number | string;
};

export function savedKvEntryChanges(key: string, value: unknown): DomainChange[] {
  return [
    {
      kind: 'kvEntry.saved',
      entry: {
        key,
        value: requiredJsonValue(value)
      }
    } satisfies KvEntrySavedChange
  ];
}

export function deletedKvEntryChanges(key: string): DomainChange[] {
  return [
    {
      kind: 'kvEntry.deleted',
      key
    } satisfies KvEntryDeletedChange
  ];
}

export function chatListKey(list: ChatList): string {
  if (list._ === 'chatListMain') {
    return 'main';
  }
  if (list._ === 'chatListArchive') {
    return 'archive';
  }
  if (list._ === 'chatListFolder' && list.chat_folder_id !== undefined) {
    return `folder:${String(list.chat_folder_id)}`;
  }
  throw new Error(`Unsupported chat list constructor: ${list._}`);
}

function requiredJsonValue(value: unknown): JsonValue {
  const json = tdJsonValue(value);
  if (json === undefined) {
    throw new Error('Expected Telegram wire JSON value');
  }
  return json;
}
