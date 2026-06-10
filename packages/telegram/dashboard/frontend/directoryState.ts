import { computed, onBeforeUnmount, onMounted, readonly, ref } from 'vue';

import {
  useDashboardHost,
  type DashboardHost,
  type DashboardHostEvent
} from '@agentg/framework/dashboard';

import type { FileRef } from '../../src/files/types.js';
import {
  fileOwnerEventKey,
  normalizeFileOwnerChangedEvent,
  type FileOwnerChangedPayload
} from './fileEvents.js';
import { normalizeFileRef } from './fileRefs.js';
import type { ChatPlacement, TelegramDirectoryChat, TelegramDirectoryFolder } from './views.js';

type TelegramDirectoryResult = {
  chats?: unknown;
  folders?: unknown;
  navigationChats?: unknown;
};

const chats = ref<TelegramDirectoryChat[]>([]);
const folders = ref<TelegramDirectoryFolder[]>([]);
const hydrated = ref(false);
const lastError = ref<unknown>(null);

const fileOwnerVersions = new Map<string, string>();
let hydratePromise: Promise<void> | null = null;
let subscribers = 0;
let stopEvents: (() => void) | null = null;

export function useTelegramDirectoryState() {
  const host = useDashboardHost();

  onMounted(() => {
    subscribers += 1;
    stopEvents ??= host.subscribeEvents(applyTelegramDirectoryEvent);
    void hydrateTelegramDirectory(host).catch(pushDirectoryStateError);
  });

  onBeforeUnmount(() => {
    subscribers -= 1;
    if (subscribers <= 0) {
      subscribers = 0;
      stopEvents?.();
      stopEvents = null;
    }
  });

  return {
    chatCount: computed(() => chats.value.length),
    chats: readonly(chats),
    folders: readonly(folders),
    hydrated: readonly(hydrated),
    lastError: readonly(lastError)
  };
}

async function hydrateTelegramDirectory(host: DashboardHost): Promise<void> {
  hydratePromise ??= host
    .rpc<TelegramDirectoryResult>('telegram.dashboard.chatDirectory', {})
    .then((directory) => {
      const directoryChats = asArray(directory.navigationChats ?? directory.chats)
        .map(normalizeDirectoryChat)
        .filter(isDefined);
      const directoryFolders = asArray(directory.folders)
        .map(normalizeDirectoryFolder)
        .filter(isDefined);

      chats.value = sortDirectoryChats(directoryChats);
      folders.value = sortDirectoryFolders(directoryFolders);
      hydrated.value = true;
      lastError.value = null;
    })
    .catch((error: unknown) => {
      hydratePromise = null;
      throw error;
    });

  await hydratePromise;
}

function applyTelegramDirectoryEvent(event: DashboardHostEvent): void {
  const fileChange = normalizeFileOwnerChangedEvent(event);
  if (fileChange !== null) {
    applyFileOwnerChange(fileChange);
    return;
  }

  if (event.type === 'telegram.chat.updated') {
    const chat = normalizeDirectoryChat(asRecord(asRecord(event.data)?.chat));
    if (chat === undefined || chat.placements.length === 0) {
      return;
    }
    chats.value = sortDirectoryChats([
      ...chats.value.filter((existing) => existing.id !== chat.id),
      chat
    ]);
    return;
  }

  if (event.type === 'telegram.chat.removed') {
    const chatId = asString(asRecord(event.data)?.chatId);
    if (chatId !== undefined) {
      chats.value = chats.value.filter((chat) => chat.id !== chatId);
    }
    return;
  }

  if (event.type === 'telegram.chat_folders.updated') {
    folders.value = sortDirectoryFolders(
      asArray(asRecord(event.data)?.folders).map(normalizeDirectoryFolder).filter(isDefined)
    );
  }
}

function applyFileOwnerChange(change: FileOwnerChangedPayload): void {
  if (!shouldApplyFileOwnerChange(change)) {
    return;
  }
  if (change.owner.ownerModel !== 'telegram.chat') {
    return;
  }
  chats.value = sortDirectoryChats(
    chats.value.map((chat) =>
      chat.id === change.owner.ownerId
        ? {
            ...chat,
            avatar: {
              big: fileBySlot(change.files, 'avatar.big'),
              small: fileBySlot(change.files, 'avatar.small')
            }
          }
        : chat
    )
  );
}

function shouldApplyFileOwnerChange(change: FileOwnerChangedPayload): boolean {
  const key = fileOwnerEventKey(change);
  const previous = fileOwnerVersions.get(key);
  if (previous !== undefined && previous > change.updatedAt) {
    return false;
  }
  fileOwnerVersions.set(key, change.updatedAt);
  return true;
}

function fileBySlot(files: FileRef[], slotKey: string): FileRef | null {
  return files.find((file) => file.slotKey === slotKey) ?? null;
}

function sortDirectoryChats(input: TelegramDirectoryChat[]): TelegramDirectoryChat[] {
  return [...input].sort(
    (left, right) => left.title.localeCompare(right.title) || left.id.localeCompare(right.id)
  );
}

function sortDirectoryFolders(input: TelegramDirectoryFolder[]): TelegramDirectoryFolder[] {
  return [...input].sort(
    (left, right) => left.position - right.position || left.folderId - right.folderId
  );
}

function normalizeDirectoryChat(
  value: Record<string, unknown> | undefined
): TelegramDirectoryChat | undefined {
  const id = asString(value?.id);
  if (id === undefined) {
    return undefined;
  }
  return {
    avatar: {
      big: normalizeFileRef(asRecord(asRecord(value?.avatar)?.big)),
      small: normalizeFileRef(asRecord(asRecord(value?.avatar)?.small))
    },
    id,
    isBot: value?.isBot === true,
    isPremium: value?.isPremium === true,
    isSelf: value?.isSelf === true,
    isUnread: value?.isUnread === true,
    lastMessage: normalizeLastMessage(asRecord(value?.lastMessage)),
    lastMessageDate: asNullableString(value?.lastMessageDate),
    notificationsEnabled:
      typeof value?.notificationsEnabled === 'boolean' ? value.notificationsEnabled : null,
    notificationsPlaceholder: value?.notificationsPlaceholder !== false,
    placements: asArray(value?.placements).map(normalizePlacement).filter(isDefined),
    title: asString(value?.title) ?? '',
    type: asString(value?.type) ?? '',
    unreadCount: asNonNegativeInteger(value?.unreadCount),
    unreadCountPlaceholder: value?.unreadCountPlaceholder !== false,
    updatedAt: asString(value?.updatedAt) ?? ''
  };
}

function normalizeLastMessage(
  value: Record<string, unknown> | undefined
): TelegramDirectoryChat['lastMessage'] {
  if (value === undefined) {
    return null;
  }
  return {
    authorName: asNullableString(value.authorName),
    authorPlaceholder: value.authorPlaceholder === true,
    date: asNullableString(value.date),
    datePlaceholder: value.datePlaceholder === true,
    isForwarded: value.isForwarded === true,
    isOutgoing: value.isOutgoing === true,
    isRead: typeof value.isRead === 'boolean' ? value.isRead : null,
    readPlaceholder: value.readPlaceholder === true,
    text: asString(value.text) ?? '',
    textPlaceholder: value.textPlaceholder === true
  };
}

function normalizeDirectoryFolder(
  value: Record<string, unknown> | undefined
): TelegramDirectoryFolder | undefined {
  const folderId = value?.folderId;
  if (typeof folderId !== 'number' || !Number.isSafeInteger(folderId) || folderId < 0) {
    return undefined;
  }
  return {
    count: asNonNegativeInteger(value?.count),
    folderId,
    iconName: asNullableString(value?.iconName),
    position: asNonNegativeInteger(value?.position),
    title: asString(value?.title) ?? ''
  };
}

function normalizePlacement(value: Record<string, unknown> | undefined): ChatPlacement | undefined {
  const kind = asString(value?.kind);
  const order = asString(value?.order) ?? '0';
  if (kind === 'main' || kind === 'archive') {
    return { isPinned: value?.isPinned === true, kind, order };
  }
  if (kind === 'folder') {
    const folderId = value?.folderId;
    if (typeof folderId === 'number' && Number.isSafeInteger(folderId) && folderId >= 0) {
      return { folderId, isPinned: value?.isPinned === true, kind, order };
    }
  }
  return undefined;
}

function asArray(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value)
    ? value.filter((item): item is Record<string, unknown> => asRecord(item) !== undefined)
    : [];
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function asNullableString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function asNonNegativeInteger(value: unknown): number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : 0;
}

function isDefined<T>(value: T | undefined): value is T {
  return value !== undefined;
}

function pushDirectoryStateError(error: unknown): void {
  lastError.value = error;
  console.error(error);
}
