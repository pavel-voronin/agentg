<script setup lang="ts">
import { computed, ref, watch } from 'vue';

import { SlotOutlet, type SlotContext } from '@agentg/control-plane-sdk/slots';

import { chatSidebarView } from './chatSidebarView.js';
import ChatSidebar from './components/ChatSidebar.vue';
import { readStorage, writeStorage } from './storage.js';
import { useTelegramDirectoryProjection } from './telegramDirectoryProjection.js';
import { useTelegramHistoryStatsProjection } from './telegramHistoryStatsProjection.js';
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

const DEFAULT_CHAT_LIMIT = 500;
const telegramStoragePrefix = 'agentg.telegram.controlPlane';
const directoryProjection = useTelegramDirectoryProjection();
const historyStatsProjection = useTelegramHistoryStatsProjection();
const chatFilter = ref(readStorage(`${telegramStoragePrefix}.chatFilter`) ?? '');
const chatFolderId = ref<number | null>(readStoredChatListSelection().folderId);
const chatListMode = ref<ChatListMode>(readStoredChatListSelection().mode);
const selectedChatId = ref(readStorage(`${telegramStoragePrefix}.selectedChatId`) ?? null);

const eventsPanelCollapsed = computed(() => props.slotContext?.eventsPanelCollapsed === true);
const nestedSlotContext = computed(() => ({
  ...(props.slotContext ?? {}),
  closeSelectedChat,
  selectedChatId: selectedChatId.value
}));
const chatNavigation = computed(() =>
  buildChatNavigation(directoryProjection.chats.value, directoryProjection.folders.value)
);
const visibleDirectoryChats = computed(() => {
  const query = normalizedChatQuery();
  const listFilter = query.length === 0 ? chatListFilter() : undefined;
  const matchingChats = directoryProjection.chats.value
    .filter((chat) => (query.length === 0 ? true : chatMatchesSearch(chat, query)))
    .filter((chat) => (listFilter === undefined ? true : chatMatchesListFilter(chat, listFilter)))
    .sort((left, right) => compareTelegramChatsByTdlibOrder(left, right, listFilter));

  return limitChats(matchingChats, DEFAULT_CHAT_LIMIT, selectedChatId.value ?? undefined);
});
const chats = computed<ControlPlaneChat[]>(() =>
  chatsWithStats(visibleDirectoryChats.value, historyStatsProjection.statsByChat.value)
);
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

watch(chatNavigation, ensureSelectedFolderExists, { immediate: true });

function clearChatSearch(): void {
  chatFilter.value = '';
  writeStorage(`${telegramStoragePrefix}.chatFilter`, '');
}

function searchChats(value: string): void {
  chatFilter.value = value;
  writeStorage(`${telegramStoragePrefix}.chatFilter`, value);
}

function chatsWithStats(
  visibleChats: TelegramDirectoryChat[],
  statsByChat: ReadonlyMap<string, ChatStats>
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

async function openChat(chatId: string): Promise<void> {
  const normalizedChatId = chatId.trim();
  if (normalizedChatId.length === 0) {
    return;
  }
  const chat = await findChatById(normalizedChatId);
  selectChatList(preferredChatListSelection(chat));
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
  const chat = directoryProjection.chats.value.find((item) => item.id === chatId);
  if (chat === undefined) {
    throw new Error(`Chat ${chatId} is not available in the chat directory`);
  }
  return chat;
}

function openMainChats(): void {
  selectMainChatList();
}

function openArchiveChats(): void {
  chatListMode.value = 'archive';
  chatFolderId.value = null;
  chatFilter.value = '';
  writeStorage(`${telegramStoragePrefix}.chatFilter`, '');
  writeStoredChatListSelection({ folderId: null, mode: 'archive' });
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

function pushLocalError(error: unknown): void {
  console.error(error);
}

function hasChatFolder(folderId: number | null): boolean {
  return (
    Number.isSafeInteger(folderId) &&
    chatNavigation.value.folders.some((folder) => folder.id === folderId)
  );
}

function ensureSelectedFolderExists(): void {
  if (normalizedChatQuery().length === 0 && chatListMode.value === 'folder') {
    if (!hasChatFolder(chatFolderId.value)) {
      selectMainChatList();
    }
  }
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

function normalizedChatQuery(): string {
  return chatFilter.value.trim().toLocaleLowerCase();
}

function chatMatchesSearch(chat: TelegramDirectoryChat, normalizedQuery: string): boolean {
  return (
    chat.title.toLocaleLowerCase().includes(normalizedQuery) ||
    chat.id.toLocaleLowerCase().includes(normalizedQuery)
  );
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
