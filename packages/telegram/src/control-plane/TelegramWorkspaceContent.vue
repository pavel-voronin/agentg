<script setup lang="ts">
import { computed, onBeforeUnmount, ref, shallowRef, watch, type CSSProperties } from 'vue';
import SolarCloseCircleBold from '~icons/solar/close-circle-bold';

import {
  SlotOutletItem,
  type SlotContext,
  type SlotDebugRegistration,
  type SlotItemResolution,
  type SlotItemRenderState,
  type SlotResolution,
  type SlotRenderState,
  useSlotRuntime
} from '@agentg/control-plane-sdk/slots';
import UiButton from '@agentg/control-plane-sdk/ui';

import { chatSidebarView } from './chatSidebarView.js';
import {
  chatFolderIds,
  chatMatchesListFilter,
  chatPlacementMatchesFilter,
  chatPlacementRank,
  type ChatListKind
} from './chatListFiltering.js';
import ChatSidebar from './components/ChatSidebar.vue';
import { readStorage, writeStorage } from './storage.js';
import { useTelegramDirectoryProjection } from './telegramDirectoryProjection.js';
import type {
  ChatListMode,
  ChatNavigation,
  ChatPlacement,
  ControlPlaneChat,
  TelegramDirectoryChat,
  TelegramDirectoryFolder
} from './views.js';

const props = defineProps<{
  slotContext?: SlotContext | undefined;
}>();

type WorkspaceTab = {
  item: SlotItemResolution & { kind: 'content' };
  label: string;
  order: number;
};

type ChatHeaderView = {
  avatarUrl: string | null;
  initials: string;
  subtitle: string;
  title: string;
};

const DEFAULT_CHAT_LIMIT = 500;
const CHAT_SIDEBAR_DEFAULT_WIDTH = 380;
const CHAT_SIDEBAR_MAX_WIDTH = 560;
const CHAT_SIDEBAR_MIN_WIDTH = 300;
const telegramStoragePrefix = 'agentg.telegram.controlPlane';
const directoryProjection = useTelegramDirectoryProjection();
const slotRuntime = useSlotRuntime();
const activePrimaryTabId = ref(readStorage(`${telegramStoragePrefix}.primaryTabId`) ?? '');
const chatFilter = ref(readStorage(`${telegramStoragePrefix}.chatFilter`) ?? '');
const chatFolderId = ref<number | null>(readStoredChatListSelection().folderId);
const chatListMode = ref<ChatListMode>(readStoredChatListSelection().mode);
const chatSidebarWidth = ref(readStoredChatSidebarWidth());
const isResizingChatSidebar = ref(false);
const selectedChatId = ref(readStorage(`${telegramStoragePrefix}.selectedChatId`) ?? null);
const primaryItemStates = shallowRef<ReadonlyMap<string, SlotItemRenderState>>(new Map());
const emptyContentAttrs: Record<string, unknown> = {};
let primaryDebugRegistration: SlotDebugRegistration | null = null;
let resizeStartX = 0;
let resizeStartWidth = CHAT_SIDEBAR_DEFAULT_WIDTH;

const nestedSlotContext = computed(() => ({
  ...(props.slotContext ?? {}),
  closeSelectedChat,
  selectedChatAvatarUrl: selectedChatAvatarUrl.value,
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
const chats = computed<ControlPlaneChat[]>(() => controlPlaneChats(visibleDirectoryChats.value));
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
const chatInterfaceStyle = computed<CSSProperties>(
  () =>
    ({
      '--telegram-chat-sidebar-width': `${String(chatSidebarWidth.value)}px`
    }) as CSSProperties
);

const primarySlot = {
  slotId: 'telegram.workspace.primary',
  tags: ['telegram.workspace']
};

const primaryResolvedItems = computed<SlotItemResolution[]>(() =>
  slotRuntime.compatibleContent(primarySlot.tags).map((content, index) => ({
    content,
    contentId: content.contentId,
    index,
    kind: 'content'
  }))
);
const primaryResolution = computed<SlotResolution>(() =>
  primaryResolvedItems.value.length === 0
    ? { kind: 'empty' }
    : {
        items: primaryResolvedItems.value,
        kind: 'contents',
        overflowCount: 0
      }
);
const primarySlotState = computed<SlotRenderState>(() => {
  if (primaryResolution.value.kind === 'empty') {
    return { kind: 'empty' };
  }
  return {
    items: primaryResolution.value.items.map(
      (item) => primaryItemStates.value.get(slotItemKey(item)) ?? initialItemState(item)
    ),
    kind: 'contents',
    overflowCount: primaryResolution.value.overflowCount
  };
});
const primaryTabs = computed(() =>
  primaryResolvedItems.value.map(workspaceTabFromItem).filter(isDefined).sort(compareWorkspaceTabs)
);
const activePrimaryTab = computed(
  () => primaryTabs.value.find((tab) => tab.item.contentId === activePrimaryTabId.value) ?? null
);
const selectedChat = computed(() =>
  selectedChatId.value === null
    ? null
    : (directoryProjection.chats.value.find((chat) => chat.id === selectedChatId.value) ?? null)
);
const selectedChatAvatarUrl = computed(() =>
  selectedChat.value === null
    ? null
    : providerFileUrl(
        selectedChat.value.avatar.small?.url ?? selectedChat.value.avatar.big?.url ?? null
      )
);
const selectedChatHeader = computed<ChatHeaderView | null>(() =>
  selectedChat.value === null
    ? null
    : {
        avatarUrl: selectedChatAvatarUrl.value,
        initials: chatInitials(selectedChat.value.title),
        subtitle: chatHeaderSubtitle(selectedChat.value),
        title: selectedChat.value.title
      }
);

watch(
  selectedChatId,
  (chatId) => {
    writeStorage(`${telegramStoragePrefix}.selectedChatId`, chatId ?? '');
  },
  { immediate: true }
);

watch(
  () => ({
    hydrated: directoryProjection.hydrated.value,
    navigation: chatNavigation.value
  }),
  ensureSelectedFolderExists,
  { immediate: true }
);

watch(
  primaryResolvedItems,
  (items) => {
    const nextKeys = new Set(items.map(slotItemKey));
    primaryItemStates.value = new Map(
      [...primaryItemStates.value.entries()].filter(([key]) => nextKeys.has(key))
    );
  },
  { immediate: true }
);

watch(
  primaryTabs,
  (tabs) => {
    if (tabs.length === 0) {
      activePrimaryTabId.value = '';
      writeStorage(`${telegramStoragePrefix}.primaryTabId`, '');
      return;
    }
    if (!tabs.some((tab) => tab.item.contentId === activePrimaryTabId.value)) {
      selectPrimaryTab(tabs[0].item.contentId);
    }
  },
  { immediate: true }
);

watch(
  () => ({
    resolution: primaryResolution.value,
    slotId: primarySlot.slotId,
    state: primarySlotState.value,
    tags: [...primarySlot.tags],
    target: null
  }),
  (entry) => {
    if (primaryDebugRegistration === null) {
      primaryDebugRegistration = slotRuntime.registerDebugEntry(entry);
      return;
    }
    primaryDebugRegistration.update(entry);
  },
  { immediate: true }
);

onBeforeUnmount(() => {
  primaryDebugRegistration?.unregister();
  primaryDebugRegistration = null;
  stopChatSidebarResize();
});

function clearChatSearch(): void {
  chatFilter.value = '';
  writeStorage(`${telegramStoragePrefix}.chatFilter`, '');
}

function searchChats(value: string): void {
  chatFilter.value = value;
  writeStorage(`${telegramStoragePrefix}.chatFilter`, value);
}

function selectPrimaryTab(contentId: string): void {
  if (!primaryTabs.value.some((tab) => tab.item.contentId === contentId)) {
    return;
  }
  activePrimaryTabId.value = contentId;
  writeStorage(`${telegramStoragePrefix}.primaryTabId`, contentId);
}

function setPrimaryItemState(item: SlotItemResolution, state: SlotItemRenderState): void {
  primaryItemStates.value = new Map(primaryItemStates.value).set(slotItemKey(item), state);
}

function chatHeaderSubtitle(chat: TelegramDirectoryChat): string {
  if (chat.isBot) {
    return 'bot';
  }
  if (chat.type === 'private') {
    return 'private chat';
  }
  if (chat.type === 'group') {
    return 'group';
  }
  if (chat.type === 'channel') {
    return 'channel';
  }
  if (chat.type === 'secret') {
    return 'secret chat';
  }
  return chat.type;
}

function chatInitials(title: string): string {
  const trimmed = title.trim();
  return trimmed.length === 0 ? '?' : trimmed.slice(0, 1).toLocaleUpperCase();
}

function providerFileUrl(url: string | null): string | null {
  if (url === null || !url.startsWith('/')) {
    return null;
  }
  return `/control-plane/provider-files/telegram/${url.slice(1).split('/').map(encodeURIComponent).join('/')}`;
}

function controlPlaneChats(visibleChats: TelegramDirectoryChat[]): ControlPlaneChat[] {
  return visibleChats.map((chat) => ({
    ...chat,
    _model: 'telegram.chat'
  }));
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
  if (!directoryProjection.hydrated.value) {
    return;
  }
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
  const folderMutedUnreadCounts = new Map<number, number>();
  const folderUnreadCounts = new Map<number, number>();
  let archiveCount = 0;
  let archiveMutedUnreadCount = 0;
  let archiveUnreadCount = 0;
  let mainCount = 0;
  let mainMutedUnreadCount = 0;
  let mainUnreadCount = 0;

  for (const chat of navigationChats) {
    if (chatMatchesListFilter(chat, { kind: 'main' })) {
      mainCount += 1;
      if (chatHasNotifyingUnreadMessages(chat)) {
        mainUnreadCount += 1;
      } else if (chatHasMutedUnreadMessages(chat)) {
        mainMutedUnreadCount += 1;
      }
    }
    if (chatMatchesListFilter(chat, { kind: 'archive' })) {
      archiveCount += 1;
      if (chatHasNotifyingUnreadMessages(chat)) {
        archiveUnreadCount += 1;
      } else if (chatHasMutedUnreadMessages(chat)) {
        archiveMutedUnreadCount += 1;
      }
    }
    for (const folderId of chatFolderIds(chat)) {
      folderCounts.set(folderId, (folderCounts.get(folderId) ?? 0) + 1);
      if (chatHasNotifyingUnreadMessages(chat)) {
        folderUnreadCounts.set(folderId, (folderUnreadCounts.get(folderId) ?? 0) + 1);
      } else if (chatHasMutedUnreadMessages(chat)) {
        folderMutedUnreadCounts.set(folderId, (folderMutedUnreadCounts.get(folderId) ?? 0) + 1);
      }
    }
  }

  const knownFolderIds = new Set(folderRows.map((folder) => folder.folderId));
  const unknownFolderIds = [...folderCounts.keys()]
    .filter((id) => !knownFolderIds.has(id))
    .sort((left, right) => left - right);

  return {
    archiveCount,
    archiveMutedUnreadCount,
    archiveUnreadCount,
    folders: [
      ...folderRows.map((folder) => ({
        count: folderCounts.get(folder.folderId) ?? 0,
        iconName: folder.iconName,
        id: folder.folderId,
        mutedUnreadCount: folderMutedUnreadCounts.get(folder.folderId) ?? 0,
        position: folder.position,
        title: folder.title,
        unreadCount: folderUnreadCounts.get(folder.folderId) ?? 0
      })),
      ...unknownFolderIds.map((id) => ({
        count: folderCounts.get(id) ?? 0,
        iconName: null,
        id,
        mutedUnreadCount: folderMutedUnreadCounts.get(id) ?? 0,
        position: id,
        title: `Folder ${String(id)}`,
        unreadCount: folderUnreadCounts.get(id) ?? 0
      }))
    ],
    mainCount,
    mainMutedUnreadCount,
    mainUnreadCount
  };
}

function chatHasNotifyingUnreadMessages(chat: TelegramDirectoryChat): boolean {
  return (chat.unreadCount > 0 || chat.isUnread) && chat.notificationsEnabled === true;
}

function chatHasMutedUnreadMessages(chat: TelegramDirectoryChat): boolean {
  return (chat.unreadCount > 0 || chat.isUnread) && chat.notificationsEnabled === false;
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

function readStoredChatSidebarWidth(): number {
  const raw = readStorage(`${telegramStoragePrefix}.chatSidebarWidth`);
  const parsed = raw === null ? Number.NaN : Number.parseInt(raw, 10);
  return clampChatSidebarWidth(parsed);
}

function writeStoredChatSidebarWidth(): void {
  writeStorage(`${telegramStoragePrefix}.chatSidebarWidth`, String(chatSidebarWidth.value));
}

function startChatSidebarResize(event: PointerEvent): void {
  resizeStartX = event.clientX;
  resizeStartWidth = chatSidebarWidth.value;
  isResizingChatSidebar.value = true;
  window.addEventListener('pointermove', resizeChatSidebar);
  window.addEventListener('pointerup', finishChatSidebarResize, { once: true });
  event.preventDefault();
}

function resizeChatSidebar(event: PointerEvent): void {
  chatSidebarWidth.value = clampChatSidebarWidth(
    resizeStartWidth + Math.round(event.clientX - resizeStartX)
  );
}

function finishChatSidebarResize(): void {
  stopChatSidebarResize();
  writeStoredChatSidebarWidth();
}

function stopChatSidebarResize(): void {
  if (!isResizingChatSidebar.value) {
    return;
  }
  isResizingChatSidebar.value = false;
  window.removeEventListener('pointermove', resizeChatSidebar);
  window.removeEventListener('pointerup', finishChatSidebarResize);
}

function resizeChatSidebarWithKeyboard(event: KeyboardEvent): void {
  if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') {
    return;
  }
  const direction = event.key === 'ArrowLeft' ? -1 : 1;
  chatSidebarWidth.value = clampChatSidebarWidth(chatSidebarWidth.value + direction * 16);
  writeStoredChatSidebarWidth();
  event.preventDefault();
}

function clampChatSidebarWidth(value: number): number {
  if (!Number.isFinite(value)) {
    return CHAT_SIDEBAR_DEFAULT_WIDTH;
  }
  return Math.min(CHAT_SIDEBAR_MAX_WIDTH, Math.max(CHAT_SIDEBAR_MIN_WIDTH, value));
}

function workspaceTabFromItem(item: SlotItemResolution): WorkspaceTab | undefined {
  if (item.kind !== 'content') {
    return undefined;
  }
  const metadata = isPlainRecord(item.content.metadata) ? item.content.metadata : {};
  const tab = isPlainRecord(metadata.tab) ? metadata.tab : undefined;
  const label = typeof tab?.label === 'string' && tab.label.trim().length > 0 ? tab.label : '';
  const order = typeof tab?.order === 'number' && Number.isFinite(tab.order) ? tab.order : null;
  if (tab === undefined || label.length === 0 || order === null) {
    return undefined;
  }
  return {
    item,
    label,
    order
  };
}

function compareWorkspaceTabs(left: WorkspaceTab, right: WorkspaceTab): number {
  if (left.order !== right.order) {
    return left.order - right.order;
  }
  return (
    left.label.localeCompare(right.label) || left.item.contentId.localeCompare(right.item.contentId)
  );
}

function initialItemState(item: SlotItemResolution): SlotItemRenderState {
  switch (item.kind) {
    case 'content':
      return {
        contentId: item.contentId,
        index: item.index,
        kind: 'component-loading'
      };
    case 'incompatible':
      return {
        contentId: item.contentId,
        index: item.index,
        kind: 'incompatible-content'
      };
    case 'missing-content':
      return {
        contentId: item.contentId,
        index: item.index,
        kind: 'missing-content'
      };
  }
}

function slotItemKey(item: SlotItemResolution): string {
  return `${String(item.index)}:${item.contentId}`;
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
  <div class="telegram-workspace">
    <section
      class="telegram-workspace__chat-interface"
      :data-resizing="isResizingChatSidebar ? 'true' : undefined"
      :style="chatInterfaceStyle"
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

      <div
        class="telegram-workspace__sidebar-resizer"
        role="separator"
        aria-label="Resize chat list"
        aria-orientation="vertical"
        :aria-valuemax="CHAT_SIDEBAR_MAX_WIDTH"
        :aria-valuemin="CHAT_SIDEBAR_MIN_WIDTH"
        :aria-valuenow="chatSidebarWidth"
        tabindex="0"
        @keydown="resizeChatSidebarWithKeyboard"
        @pointerdown="startChatSidebarResize"
      >
        <span class="telegram-workspace__sidebar-resizer-line"></span>
      </div>

      <div class="telegram-workspace__primary-panel">
        <div v-if="selectedChatId === null" class="telegram-workspace__empty-state">
          <div class="telegram-workspace__empty-content">
            <div class="telegram-workspace__empty-title">No chat selected</div>
            <div class="telegram-workspace__empty-copy">Select a chat from the list.</div>
          </div>
        </div>

        <div v-else class="telegram-workspace__tab-layout">
          <div v-if="selectedChatHeader" class="telegram-workspace__chat-header">
            <img
              v-if="selectedChatHeader.avatarUrl"
              class="telegram-workspace__chat-header-avatar"
              :src="selectedChatHeader.avatarUrl"
              alt=""
            />
            <div v-else class="telegram-workspace__chat-header-initials">
              {{ selectedChatHeader.initials }}
            </div>
            <div class="telegram-workspace__chat-header-main">
              <div class="telegram-workspace__chat-header-title">
                {{ selectedChatHeader.title }}
              </div>
              <div class="telegram-workspace__chat-header-subtitle">
                {{ selectedChatHeader.subtitle }}
              </div>
            </div>
            <UiButton
              class="telegram-workspace__chat-header-close"
              aria-label="Close chat"
              size="icon-md"
              title="Close chat"
              @click="closeSelectedChat"
            >
              <SolarCloseCircleBold
                class="telegram-workspace__chat-header-close-icon"
                aria-hidden="true"
              />
            </UiButton>
          </div>
          <div class="telegram-workspace__tab-list" role="tablist" aria-label="Chat workspace">
            <button
              v-for="tab in primaryTabs"
              :key="tab.item.contentId"
              type="button"
              role="tab"
              class="telegram-workspace__tab-button"
              :aria-selected="tab.item.contentId === activePrimaryTabId"
              :data-active="tab.item.contentId === activePrimaryTabId ? 'true' : undefined"
              @click="selectPrimaryTab(tab.item.contentId)"
            >
              {{ tab.label }}
            </button>
          </div>

          <div class="telegram-workspace__tab-body">
            <SlotOutletItem
              v-if="activePrimaryTab"
              :content-attrs="emptyContentAttrs"
              :context="nestedSlotContext"
              :item="activePrimaryTab.item"
              @state-change="(state) => setPrimaryItemState(activePrimaryTab.item, state)"
            />
            <div v-else class="telegram-workspace__tab-empty">No workspace tabs available.</div>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
@reference "tailwindcss";
.telegram-workspace {
  @apply h-full min-h-0 overflow-hidden;
}

.telegram-workspace__chat-interface {
  @apply relative grid h-full min-h-0 min-w-0 grid-cols-[var(--telegram-chat-sidebar-width)_minmax(0,1fr)] overflow-hidden rounded-lg border border-zinc-200 bg-white;
}

.telegram-workspace__chat-interface[data-resizing='true'] {
  @apply cursor-col-resize select-none;
}

.telegram-workspace__sidebar-resizer {
  @apply absolute bottom-0 top-0 z-10 flex w-[5px] cursor-col-resize justify-center bg-transparent focus:outline-none;
  left: calc(var(--telegram-chat-sidebar-width) - 2px);
}

.telegram-workspace__sidebar-resizer-line {
  @apply block h-full w-px bg-zinc-200;
}

.telegram-workspace__primary-panel {
  @apply min-h-0 min-w-0 overflow-hidden bg-white;
}

.telegram-workspace__empty-state {
  @apply flex h-full min-h-0 items-center justify-center p-8 text-center;
}

.telegram-workspace__empty-content {
  @apply max-w-sm;
}

.telegram-workspace__empty-title {
  @apply text-base font-semibold text-zinc-900;
}

.telegram-workspace__empty-copy {
  @apply mt-2 text-sm text-zinc-500;
}

.telegram-workspace__tab-layout {
  @apply flex h-full min-h-0 flex-col bg-white;
}

.telegram-workspace__chat-header {
  @apply flex shrink-0 items-center justify-between gap-3 border-b border-zinc-200 px-4 py-3;
}

.telegram-workspace__chat-header-avatar {
  @apply h-10 w-10 shrink-0 rounded-full object-cover;
}

.telegram-workspace__chat-header-initials {
  @apply flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-teal-700 text-sm font-semibold text-white;
}

.telegram-workspace__chat-header-main {
  @apply min-w-0 flex-1;
}

.telegram-workspace__chat-header-title {
  @apply truncate text-base font-semibold text-zinc-900;
}

.telegram-workspace__chat-header-subtitle {
  @apply mt-0.5 truncate text-xs text-zinc-500;
}

.telegram-workspace__chat-header-close {
  @apply shrink-0 text-zinc-600;
}

.telegram-workspace__chat-header-close-icon {
  @apply h-4 w-4;
}

.telegram-workspace__tab-list {
  @apply flex shrink-0 gap-1 border-b border-zinc-200 px-4 pt-2;
}

.telegram-workspace__tab-button {
  @apply border-b-2 border-transparent px-3 py-2 text-sm font-medium text-zinc-500 hover:text-zinc-900;
}

.telegram-workspace__tab-button[data-active='true'] {
  @apply border-teal-600 text-teal-700;
}

.telegram-workspace__tab-body {
  @apply min-h-0 flex-1 overflow-hidden;
}

.telegram-workspace__tab-empty {
  @apply p-8 text-center text-sm text-zinc-500;
}
</style>
