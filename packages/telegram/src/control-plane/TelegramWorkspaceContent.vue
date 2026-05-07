<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';

import { useControlPlaneHost } from '@agentg/control-plane-sdk/host';
import { SlotOutlet, type SlotContext } from '@agentg/control-plane-sdk/slots';

import { chatSidebarView } from './chatSidebarView.js';
import ChatSidebar from './components/ChatSidebar.vue';
import { readStorage, writeStorage } from './storage.js';
import type {
  ChatListMode,
  ChatNavigation,
  ChatPlacement,
  ChatStats,
  ControlPlaneChat,
  TelegramDirectoryChat,
  TelegramDirectoryFolder
} from './views.js';

const props = defineProps<{
  slotContext?: SlotContext | undefined;
}>();

type ChatListKind =
  | {
      kind: 'archive';
    }
  | {
      kind: 'main';
    }
  | {
      folderId: number;
      kind: 'folder';
    };

type TelegramDirectoryResult = {
  chats?: unknown;
  folders?: unknown;
  navigationChats?: unknown;
};

type HistoryChatStatsResult = {
  stats?: unknown;
};

const DEFAULT_CHAT_LIMIT = 500;
const telegramStoragePrefix = 'agentg.telegram.controlPlane';
const host = useControlPlaneHost();
const chatFilter = ref(readStorage(`${telegramStoragePrefix}.chatFilter`) ?? '');
const chatFolderId = ref<number | null>(readStoredChatListSelection().folderId);
const chatListMode = ref<ChatListMode>(readStoredChatListSelection().mode);
const chatNavigation = ref<ChatNavigation>(emptyChatNavigation());
const chats = ref<ControlPlaneChat[]>([]);
const selectedChatId = ref(readStorage(`${telegramStoragePrefix}.selectedChatId`) ?? null);
let refreshTimer: ReturnType<typeof setTimeout> | null = null;
let stopEvents: (() => void) | null = null;
let chatLoadSequence = 0;

const eventsPanelCollapsed = computed(() => props.slotContext?.eventsPanelCollapsed === true);
const nestedSlotContext = computed(() => ({
  ...(props.slotContext ?? {}),
  closeSelectedChat,
  selectedChatId: selectedChatId.value
}));
const chatSidebar = computed(() =>
  chatSidebarView(
    {
      chatFilter: chatFilter.value,
      chatFolderId: chatFolderId.value,
      chatListMode: chatListMode.value,
      chatNavigation: chatNavigation.value,
      chats: chats.value
    },
    selectedChatId.value
  )
);

const primarySlot = {
  slotId: 'telegram.workspace.primary',
  tags: ['telegram.workspace.content']
};

const sidecarSlot = {
  slotId: 'telegram.workspace.sidecar',
  tags: ['control-plane.events']
};

watch(
  selectedChatId,
  (chatId) => {
    writeStorage(`${telegramStoragePrefix}.selectedChatId`, chatId ?? '');
  },
  { immediate: true }
);

onMounted(() => {
  stopEvents = host.subscribeEvents((event) => {
    const type = event.type ?? '';
    if (type.startsWith('telegram.') || type.startsWith('history.')) {
      scheduleChatRefresh();
    }
  });
  void loadChats().catch(pushLocalError);
});

onBeforeUnmount(() => {
  stopEvents?.();
  stopEvents = null;
  clearRefreshTimer();
});

function clearChatSearch(): void {
  chatFilter.value = '';
  writeStorage(`${telegramStoragePrefix}.chatFilter`, '');
  clearRefreshTimer();
  void loadChats().catch(pushLocalError);
}

function searchChats(value: string): void {
  chatFilter.value = value;
  writeStorage(`${telegramStoragePrefix}.chatFilter`, value);
  clearRefreshTimer();
  refreshTimer = setTimeout(() => {
    void loadChats().catch(pushLocalError);
  }, 250);
}

async function loadChats(options: { focusChatId?: string } = {}): Promise<void> {
  const sequence = ++chatLoadSequence;
  const query = chatFilter.value.trim();
  const directory = await host.rpc<TelegramDirectoryResult>('telegram.listChatDirectory', {
    ...(query.length === 0 ? {} : { query })
  });
  if (sequence !== chatLoadSequence) {
    return;
  }

  const directoryChats = asArray(directory.chats).map(normalizeDirectoryChat).filter(isDefined);
  const folders = asArray(directory.folders).map(normalizeDirectoryFolder).filter(isDefined);
  const navigationChats = asArray(directory.navigationChats)
    .map(normalizeDirectoryChat)
    .filter(isDefined);
  const listFilter = query.length === 0 ? chatListFilter() : undefined;
  const matchingChats = directoryChats
    .filter((chat) => (listFilter === undefined ? true : chatMatchesListFilter(chat, listFilter)))
    .sort((left, right) => compareTelegramChatsByTdlibOrder(left, right, listFilter));
  const visibleChats = limitChats(matchingChats, DEFAULT_CHAT_LIMIT, options.focusChatId);

  chats.value = chatsWithStats(visibleChats, existingStatsByChat());
  chatNavigation.value = buildChatNavigation(navigationChats, folders);
  if (query.length === 0 && chatListMode.value === 'folder' && !hasChatFolder(chatFolderId.value)) {
    selectMainChatList();
    await loadChats();
    return;
  }

  void loadStatsForVisibleChats(sequence, visibleChats);
}

async function loadStatsForVisibleChats(
  sequence: number,
  visibleChats: TelegramDirectoryChat[]
): Promise<void> {
  try {
    const statsByChat = await loadStatsByChat(visibleChats.map((chat) => chat.id));
    if (sequence !== chatLoadSequence) {
      return;
    }
    chats.value = chatsWithStats(visibleChats, statsByChat);
  } catch (error) {
    if (sequence === chatLoadSequence) {
      pushLocalError(error);
    }
  }
}

function chatsWithStats(
  visibleChats: TelegramDirectoryChat[],
  statsByChat: Map<string, ChatStats>
): ControlPlaneChat[] {
  return visibleChats.map((chat) => {
    const stats = statsByChat.get(chat.id) ?? emptyChatStats(chat.id);
    return {
      ...chat,
      _model: 'telegram.chat',
      coverageIntervals: stats.coverageIntervals,
      coverageNewestAt: stats.coverageNewestAt,
      coverageOldestAt: stats.coverageOldestAt,
      pendingJobs: stats.pendingJobs,
      runningJobs: stats.runningJobs,
      targets: stats.targets
    };
  });
}

async function loadStatsByChat(chatIds: string[]): Promise<Map<string, ChatStats>> {
  if (chatIds.length === 0) {
    return new Map();
  }
  const result = await host.rpc<HistoryChatStatsResult>('history.getChatStats', { chatIds });
  const stats = asArray(result.stats).map(normalizeChatStats).filter(isDefined);
  return new Map(stats.map((stat) => [stat.chatId, stat]));
}

function existingStatsByChat(): Map<string, ChatStats> {
  return new Map(
    chats.value.map((chat) => [
      chat.id,
      {
        chatId: chat.id,
        coverageIntervals: chat.coverageIntervals,
        coverageNewestAt: chat.coverageNewestAt,
        coverageOldestAt: chat.coverageOldestAt,
        pendingJobs: chat.pendingJobs,
        runningJobs: chat.runningJobs,
        targets: chat.targets
      }
    ])
  );
}

async function openChat(chatId: string): Promise<void> {
  const normalizedChatId = chatId.trim();
  if (normalizedChatId.length === 0) {
    return;
  }
  const chat = await findChatById(normalizedChatId);
  selectChatList(preferredChatListSelection(chat));
  await loadChats({ focusChatId: normalizedChatId });
  if (!chats.value.some((item) => item.id === normalizedChatId)) {
    throw new Error(`Chat ${normalizedChatId} is not visible in its Telegram list`);
  }
  selectedChatId.value = normalizedChatId;
}

async function toggleChat(chatId: string): Promise<void> {
  if (selectedChatId.value === chatId) {
    closeSelectedChat();
    return;
  }
  selectedChatId.value = chatId;
}

async function findChatById(chatId: string): Promise<TelegramDirectoryChat> {
  const result = await host.rpc<TelegramDirectoryResult>('telegram.listChatDirectory', {
    query: chatId
  });
  const chat = asArray(result.chats)
    .map(normalizeDirectoryChat)
    .find((item) => item?.id === chatId);
  if (chat === undefined) {
    throw new Error(`Chat ${chatId} is not available in the chat directory`);
  }
  return chat;
}

function openMainChats(): void {
  selectMainChatList();
  void loadChats().catch(pushLocalError);
}

function openArchiveChats(): void {
  chatListMode.value = 'archive';
  chatFolderId.value = null;
  chatFilter.value = '';
  writeStorage(`${telegramStoragePrefix}.chatFilter`, '');
  writeStoredChatListSelection({ folderId: null, mode: 'archive' });
  void loadChats().catch(pushLocalError);
}

function openFolderChats(folderId: number): void {
  if (!Number.isSafeInteger(folderId)) {
    return;
  }
  chatListMode.value = 'folder';
  chatFolderId.value = folderId;
  chatFilter.value = '';
  writeStorage(`${telegramStoragePrefix}.chatFilter`, '');
  writeStoredChatListSelection({ folderId, mode: 'folder' });
  void loadChats().catch(pushLocalError);
}

function selectMainChatList(): void {
  chatListMode.value = 'main';
  chatFolderId.value = null;
  chatFilter.value = '';
  writeStorage(`${telegramStoragePrefix}.chatFilter`, '');
  writeStoredChatListSelection({ folderId: null, mode: 'main' });
}

function closeSelectedChat(): void {
  selectedChatId.value = null;
}

function scheduleChatRefresh(): void {
  clearRefreshTimer();
  refreshTimer = setTimeout(() => {
    void loadChats().catch(pushLocalError);
  }, 250);
}

function clearRefreshTimer(): void {
  if (refreshTimer !== null) {
    clearTimeout(refreshTimer);
    refreshTimer = null;
  }
}

function pushLocalError(error: unknown): void {
  console.error(error);
}

function hasChatFolder(folderId: number | null): boolean {
  return (
    Number.isSafeInteger(folderId) &&
    chatNavigation.value.folders.some((folder) => folder.id === folderId)
  );
}

function chatListFilter(): ChatListKind {
  if (chatListMode.value === 'archive') {
    return { kind: 'archive' };
  }
  if (chatListMode.value === 'folder' && chatFolderId.value !== null) {
    return { folderId: chatFolderId.value, kind: 'folder' };
  }
  return { kind: 'main' };
}

function buildChatNavigation(
  navigationChats: TelegramDirectoryChat[],
  folderRows: TelegramDirectoryFolder[]
): ChatNavigation {
  const folderCounts = new Map<number, number>();
  let archiveCount = 0;
  let mainCount = 0;

  for (const chat of navigationChats) {
    if (chatMatchesListFilter(chat, { kind: 'main' })) {
      mainCount += 1;
    }
    if (chatMatchesListFilter(chat, { kind: 'archive' })) {
      archiveCount += 1;
    }
    for (const folderId of chatFolderIds(chat)) {
      folderCounts.set(folderId, (folderCounts.get(folderId) ?? 0) + 1);
    }
  }

  const knownFolderIds = new Set(folderRows.map((folder) => folder.folderId));
  const unknownFolderIds = [...folderCounts.keys()]
    .filter((id) => !knownFolderIds.has(id))
    .sort((left, right) => left - right);

  return {
    archiveCount,
    folders: [
      ...folderRows.map((folder) => ({
        count: folderCounts.get(folder.folderId) ?? 0,
        iconName: folder.iconName,
        id: folder.folderId,
        position: folder.position,
        title: folder.title
      })),
      ...unknownFolderIds.map((id) => ({
        count: folderCounts.get(id) ?? 0,
        iconName: null,
        id,
        position: id,
        title: `Folder ${String(id)}`
      }))
    ],
    mainCount
  };
}

function chatMatchesListFilter(chat: TelegramDirectoryChat, filter: ChatListKind): boolean {
  return chat.placements.some((placement) => chatPlacementMatchesFilter(placement, filter));
}

function chatFolderIds(chat: TelegramDirectoryChat): number[] {
  return chat.placements
    .filter((placement) => placement.kind === 'folder')
    .map((placement) => placement.folderId);
}

function limitChats(
  input: TelegramDirectoryChat[],
  limit: number,
  focusChatId: string | undefined
): TelegramDirectoryChat[] {
  const limited = input.slice(0, limit);
  if (focusChatId === undefined || limited.some((chat) => chat.id === focusChatId)) {
    return limited;
  }
  const focusedChat = input.find((chat) => chat.id === focusChatId);
  return focusedChat === undefined ? limited : [...limited, focusedChat];
}

function compareTelegramChatsByTdlibOrder(
  left: TelegramDirectoryChat,
  right: TelegramDirectoryChat,
  filter?: ChatListKind
): number {
  const leftKey = telegramChatSortKey(left, filter);
  const rightKey = telegramChatSortKey(right, filter);

  if (leftKey.listRank !== rightKey.listRank) {
    return leftKey.listRank - rightKey.listRank;
  }

  const orderComparison = compareBigIntDescending(leftKey.order, rightKey.order);
  if (orderComparison !== 0) {
    return orderComparison;
  }

  if (leftKey.lastMessageDate !== rightKey.lastMessageDate) {
    return rightKey.lastMessageDate - leftKey.lastMessageDate;
  }

  return leftKey.title.localeCompare(rightKey.title) || leftKey.id.localeCompare(rightKey.id);
}

function telegramChatSortKey(chat: TelegramDirectoryChat, filter?: ChatListKind) {
  const position = preferredChatPlacement(chat, filter);
  return {
    id: chat.id,
    lastMessageDate: chat.lastMessageDate,
    listRank: position?.listRank ?? 3,
    order: position?.order ?? 0n,
    title: chat.title
  };
}

function preferredChatPlacement(
  chat: TelegramDirectoryChat,
  filter?: ChatListKind
): { listRank: number; order: bigint } | undefined {
  const placements = chat.placements
    .map((placement) => {
      const order = parsePositiveBigInt(placement.order);
      if (order === undefined) {
        return undefined;
      }
      if (filter !== undefined && !chatPlacementMatchesFilter(placement, filter)) {
        return undefined;
      }
      return {
        listRank: chatPlacementRank(placement),
        order
      };
    })
    .filter(isDefined);

  return placements.sort((left, right) => {
    if (left.listRank !== right.listRank) {
      return left.listRank - right.listRank;
    }
    return compareBigIntDescending(left.order, right.order);
  })[0];
}

function chatPlacementMatchesFilter(placement: ChatPlacement, filter: ChatListKind): boolean {
  if (filter.kind === 'main') {
    return placement.kind === 'main';
  }
  if (filter.kind === 'archive') {
    return placement.kind === 'archive';
  }
  return placement.kind === 'folder' && placement.folderId === filter.folderId;
}

function chatPlacementRank(placement: ChatPlacement): number {
  if (placement.kind === 'main') {
    return 0;
  }
  if (placement.kind === 'archive') {
    return 1;
  }
  return 2;
}

function preferredChatListSelection(chat: TelegramDirectoryChat): {
  folderId: number | null;
  mode: ChatListMode;
} {
  const placement = [...chat.placements].sort(compareChatPlacements)[0];
  if (placement === undefined) {
    throw new Error(`Chat ${chat.id} has no Telegram list placement`);
  }
  if (placement.kind === 'folder') {
    return { folderId: placement.folderId, mode: 'folder' };
  }
  return { folderId: null, mode: placement.kind };
}

function compareChatPlacements(left: ChatPlacement, right: ChatPlacement): number {
  const leftRank = chatPlacementRank(left);
  const rightRank = chatPlacementRank(right);
  if (leftRank !== rightRank) {
    return leftRank - rightRank;
  }
  const orderComparison = compareBigIntDescending(
    parsePositiveBigInt(left.order) ?? 0n,
    parsePositiveBigInt(right.order) ?? 0n
  );
  if (orderComparison !== 0) {
    return orderComparison;
  }
  const leftFolderId = left.kind === 'folder' ? left.folderId : 0;
  const rightFolderId = right.kind === 'folder' ? right.folderId : 0;
  return leftFolderId - rightFolderId;
}

function selectChatList(selection: { folderId: number | null; mode: ChatListMode }): void {
  if (selection.mode === 'main') {
    selectMainChatList();
    return;
  }
  if (selection.mode === 'archive') {
    chatListMode.value = 'archive';
    chatFolderId.value = null;
    writeStoredChatListSelection({ folderId: null, mode: 'archive' });
    return;
  }
  if (selection.folderId !== null) {
    chatListMode.value = 'folder';
    chatFolderId.value = selection.folderId;
    writeStoredChatListSelection(selection);
  }
}

function normalizeDirectoryChat(value: Record<string, unknown>): TelegramDirectoryChat | undefined {
  const id = asString(value.id);
  if (id === undefined) {
    return undefined;
  }
  return {
    id,
    isBot: value.isBot === true,
    lastMessageDate: asNonNegativeInteger(value.lastMessageDate),
    placements: asArray(value.placements).map(normalizePlacement).filter(isDefined),
    title: asString(value.title) ?? '',
    type: asString(value.type) ?? '',
    updatedAt: asString(value.updatedAt) ?? ''
  };
}

function normalizeDirectoryFolder(
  value: Record<string, unknown>
): TelegramDirectoryFolder | undefined {
  const folderId = value.folderId;
  if (typeof folderId !== 'number' || !Number.isSafeInteger(folderId) || folderId < 0) {
    return undefined;
  }
  return {
    count: asNonNegativeInteger(value.count),
    folderId,
    iconName: asNullableString(value.iconName),
    position: asNonNegativeInteger(value.position),
    title: asString(value.title) ?? ''
  };
}

function normalizePlacement(value: Record<string, unknown>): ChatPlacement | undefined {
  const kind = asString(value.kind);
  const order = asString(value.order) ?? '0';
  if (kind === 'main' || kind === 'archive') {
    return { kind, order };
  }
  if (kind === 'folder') {
    const folderId = value.folderId;
    if (typeof folderId === 'number' && Number.isSafeInteger(folderId) && folderId >= 0) {
      return { folderId, kind, order };
    }
  }
  return undefined;
}

function normalizeChatStats(value: Record<string, unknown>): ChatStats | undefined {
  const chatId = asString(value.chatId);
  if (chatId === undefined) {
    return undefined;
  }
  return {
    chatId,
    coverageIntervals: asNonNegativeInteger(value.coverageIntervals),
    coverageNewestAt: asNullableString(value.coverageNewestAt),
    coverageOldestAt: asNullableString(value.coverageOldestAt),
    pendingJobs: asNonNegativeInteger(value.pendingJobs),
    runningJobs: asNonNegativeInteger(value.runningJobs),
    targets: asNonNegativeInteger(value.targets)
  };
}

function emptyChatStats(chatId: string): ChatStats {
  return {
    chatId,
    coverageIntervals: 0,
    coverageNewestAt: null,
    coverageOldestAt: null,
    pendingJobs: 0,
    runningJobs: 0,
    targets: 0
  };
}

function emptyChatNavigation(): ChatNavigation {
  return {
    archiveCount: 0,
    folders: [],
    mainCount: 0
  };
}

function readStoredChatListSelection(): { folderId: number | null; mode: ChatListMode } {
  const raw = readStorage(`${telegramStoragePrefix}.chatListSelection`);
  if (raw === null) {
    return { folderId: null, mode: 'main' };
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    if (
      isPlainRecord(parsed) &&
      parsed.mode === 'folder' &&
      Number.isSafeInteger(parsed.folderId)
    ) {
      return { folderId: parsed.folderId as number, mode: 'folder' };
    }
    if (isPlainRecord(parsed) && parsed.mode === 'archive') {
      return { folderId: null, mode: 'archive' };
    }
  } catch {
    return { folderId: null, mode: 'main' };
  }
  return { folderId: null, mode: 'main' };
}

function writeStoredChatListSelection(selection: {
  folderId: number | null;
  mode: ChatListMode;
}): void {
  writeStorage(
    `${telegramStoragePrefix}.chatListSelection`,
    JSON.stringify(
      selection.mode === 'folder' && Number.isSafeInteger(selection.folderId)
        ? { folderId: selection.folderId, mode: 'folder' }
        : { mode: selection.mode === 'archive' ? 'archive' : 'main' }
    )
  );
}

function compareBigIntDescending(left: bigint, right: bigint): number {
  if (left === right) {
    return 0;
  }
  return left > right ? -1 : 1;
}

function parsePositiveBigInt(value: unknown): bigint | undefined {
  if (typeof value === 'number' && Number.isSafeInteger(value) && value > 0) {
    return BigInt(value);
  }
  if (typeof value === 'string' && /^[0-9]+$/.test(value)) {
    const parsed = BigInt(value);
    return parsed > 0n ? parsed : undefined;
  }
  return undefined;
}

function asArray(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value)
    ? value.filter((item): item is Record<string, unknown> => isPlainRecord(item))
    : [];
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function asNullableString(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function asNonNegativeInteger(value: unknown): number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : 0;
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isDefined<T>(value: T | undefined): value is T {
  return value !== undefined;
}
</script>

<template>
  <div
    class="telegram-workspace"
    :data-events-collapsed="eventsPanelCollapsed ? 'true' : undefined"
  >
    <ChatSidebar
      :view="chatSidebar"
      @archive-open="openArchiveChats"
      @chat-open="(chatId) => void openChat(chatId).catch(pushLocalError)"
      @chat-toggle="(chatId) => void toggleChat(chatId).catch(pushLocalError)"
      @folder-open="openFolderChats"
      @main-open="openMainChats"
      @search-clear="clearChatSearch"
      @search-input="searchChats"
    />

    <SlotOutlet
      :context="nestedSlotContext"
      :slot-id="primarySlot.slotId"
      :tags="primarySlot.tags"
    />

    <SlotOutlet
      v-if="!eventsPanelCollapsed"
      :context="{ ...nestedSlotContext, idPrefix: 'events' }"
      :slot-id="sidecarSlot.slotId"
      :tags="sidecarSlot.tags"
    />
  </div>
</template>

<style scoped>
@reference "tailwindcss";
.telegram-workspace {
  @apply grid h-full min-h-0 grid-cols-[380px_minmax(0,1fr)_420px] gap-4 overflow-hidden;
}

.telegram-workspace[data-events-collapsed='true'] {
  @apply grid-cols-[380px_minmax(0,1fr)];
}
</style>
