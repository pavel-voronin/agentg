import { computed, onBeforeUnmount, onMounted, readonly, ref } from 'vue';

import {
  useControlPlaneHost,
  type ControlPlaneHost,
  type ControlPlaneHostEvent
} from '@agentg/control-plane-sdk/host';

import type { ChatPlacement, TelegramDirectoryChat, TelegramDirectoryFolder } from './views.js';
import type { TelegramFileRef } from '../rpc/contracts.js';

type TelegramDirectoryResult = {
  chats?: unknown;
  folders?: unknown;
  navigationChats?: unknown;
};

const chats = ref<TelegramDirectoryChat[]>([]);
const folders = ref<TelegramDirectoryFolder[]>([]);
const hydrated = ref(false);
const lastError = ref<unknown>(null);

let hydratePromise: Promise<void> | null = null;
let subscribers = 0;
let stopEvents: (() => void) | null = null;

export function useTelegramDirectoryProjection() {
  const host = useControlPlaneHost();

  onMounted(() => {
    subscribers += 1;
    stopEvents ??= host.subscribeEvents(applyTelegramDirectoryEvent);
    void hydrateTelegramDirectory(host).catch(pushProjectionError);
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

async function hydrateTelegramDirectory(host: ControlPlaneHost): Promise<void> {
  hydratePromise ??= host
    .rpc<TelegramDirectoryResult>('telegram.listChatDirectory', {})
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

function applyTelegramDirectoryEvent(event: ControlPlaneHostEvent): void {
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
    lastMessageDate: asNonNegativeInteger(value?.lastMessageDate),
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
    date: asNonNegativeInteger(value.date),
    datePlaceholder: value.datePlaceholder === true,
    isForwarded: value.isForwarded === true,
    isOutgoing: value.isOutgoing === true,
    isRead: typeof value.isRead === 'boolean' ? value.isRead : null,
    readPlaceholder: value.readPlaceholder === true,
    text: asString(value.text) ?? '',
    textPlaceholder: value.textPlaceholder === true
  };
}

function normalizeFileRef(value: Record<string, unknown> | undefined): TelegramFileRef | null {
  const id = asString(value?.id);
  const owner = normalizeFileOwner(value?.owner);
  const slotKey = asString(value?.slotKey);
  const status = asString(value?.status);
  const mediaKind = asString(value?.mediaKind);
  const renderKind = asString(value?.renderKind);
  const updatedAt = asString(value?.updatedAt);
  if (
    id === undefined ||
    owner === null ||
    slotKey === undefined ||
    !isFileStatus(status) ||
    !isFileMediaKind(mediaKind) ||
    !isFileRenderKind(renderKind) ||
    updatedAt === undefined
  ) {
    return null;
  }
  return {
    _model: 'telegram.file',
    byteSize: asNullableNonNegativeInteger(value?.byteSize),
    canRequest: value?.canRequest === true,
    downloadedByteSize: asNullableNonNegativeInteger(value?.downloadedByteSize),
    downloadError: asNullableString(value?.downloadError),
    durationSeconds: asNullableNonNegativeInteger(value?.durationSeconds),
    fileName: asNullableString(value?.fileName),
    height: asNullableNonNegativeInteger(value?.height),
    id,
    mediaKind,
    mimeType: asNullableString(value?.mimeType),
    owner,
    renderKind,
    slotKey,
    status,
    updatedAt,
    url: asNullableString(value?.url),
    width: asNullableNonNegativeInteger(value?.width)
  };
}

function normalizeFileOwner(value: unknown): TelegramFileRef['owner'] | null {
  const owner = asRecord(value);
  const model = asString(owner?._model);
  const id = asString(owner?.id);
  if (id === undefined) {
    return null;
  }
  if (model === 'telegram.chat') {
    return { _model: 'telegram.chat', id };
  }
  if (model === 'telegram.message') {
    return { _model: 'telegram.message', id };
  }
  return null;
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

function asNullableNonNegativeInteger(value: unknown): number | null {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : null;
}

function asNonNegativeInteger(value: unknown): number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : 0;
}

function isDefined<T>(value: T | undefined): value is T {
  return value !== undefined;
}

function isFileStatus(value: string | undefined): value is TelegramFileRef['status'] {
  return (
    value === 'known' ||
    value === 'queued' ||
    value === 'downloading' ||
    value === 'ready' ||
    value === 'failed'
  );
}

function isFileMediaKind(value: string | undefined): value is TelegramFileRef['mediaKind'] {
  return (
    value === 'avatar' ||
    value === 'document' ||
    value === 'photo' ||
    value === 'thumbnail' ||
    value === 'video' ||
    value === 'voice'
  );
}

function isFileRenderKind(value: string | undefined): value is TelegramFileRef['renderKind'] {
  return value === 'audio' || value === 'download' || value === 'image' || value === 'video';
}

function pushProjectionError(error: unknown): void {
  lastError.value = error;
  console.error(error);
}
