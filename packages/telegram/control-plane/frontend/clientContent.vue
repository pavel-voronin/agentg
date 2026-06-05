<script setup lang="ts">
import { computed, onBeforeUnmount, ref, shallowRef, watch } from 'vue';

import {
  slotRoute,
  type SlotContext,
  type SlotDebugRegistration,
  type SlotItemResolution,
  type SlotItemRenderState,
  type SlotResolution,
  type SlotRenderState,
  useSlotRuntime
} from '@agentg/framework/cp';

import { chatSidebarView } from './chatSidebarView.js';
import ChatSidebar from './components/chatSidebar.vue';
import ChatSidebarResizer from './components/chatSidebarResizer.vue';
import ClientPrimaryPanel from './components/clientPrimaryPanel.vue';
import { useTelegramDirectoryState } from './directoryState.js';
import { readStorage, writeStorage } from './storage.js';
import { useChatSidebarResize } from './useChatSidebarResize.js';
import type { ChatListMode, ControlPlaneChat, TelegramDirectoryChat } from './views.js';
import {
  buildChatHeaderView,
  buildChatNavigation,
  chatListFilter,
  controlPlaneChats,
  normalizedChatQuery,
  preferredChatListSelection,
  providerFileUrl,
  visibleDirectoryChats as filterDirectoryChats
} from './clientChat.js';
import {
  chatIdFromClientRouteSegments,
  clientRouteSegmentsForChat,
  tabSegmentFromClientRouteSegments
} from './clientRoute.js';
import {
  compareClientTabs,
  initialItemState,
  slotItemKey,
  clientTabFromItem,
  type ClientTab
} from './clientSlots.js';

const props = defineProps<{
  slotContext?: SlotContext | undefined;
}>();

const telegramStoragePrefix = 'agentg.telegram.controlPlane';
const directoryState = useTelegramDirectoryState();
const slotRuntime = useSlotRuntime();
const storedChatListSelection = readStoredChatListSelection();
const chatFilter = ref(readStorage(`${telegramStoragePrefix}.chatFilter`) ?? '');
const chatFolderId = ref<number | null>(storedChatListSelection.folderId);
const chatListMode = ref<ChatListMode>(storedChatListSelection.mode);
const primaryItemStates = shallowRef<ReadonlyMap<string, SlotItemRenderState>>(new Map());
const emptyContentAttrs: Record<string, unknown> = {};
let primaryDebugRegistration: SlotDebugRegistration | null = null;

const {
  maxWidth: chatSidebarMaxWidth,
  minWidth: chatSidebarMinWidth,
  resizeWithKeyboard: resizeChatSidebarWithKeyboard,
  resizing: isResizingChatSidebar,
  start: startChatSidebarResize,
  stop: stopChatSidebarResize,
  style: chatInterfaceStyle,
  width: chatSidebarWidth
} = useChatSidebarResize(`${telegramStoragePrefix}.chatSidebarWidth`);

const primarySlot = {
  slotId: 'telegram.client.primary',
  tags: ['telegram.client']
};

const route = computed(() => slotRoute(props.slotContext));
const chatNavigation = computed(() =>
  buildChatNavigation(directoryState.chats.value, directoryState.folders.value)
);
const routeChatId = computed(() => chatIdFromClientRouteSegments(route.value.segments));
const routePrimaryTabSegment = computed(() =>
  tabSegmentFromClientRouteSegments(route.value.segments)
);
const selectedChatId = ref(initialSelectedChatId());
const selectedChatRoute = computed(() =>
  selectedChatId.value === null ? route.value : route.value.child(2)
);
const visibleDirectoryChats = computed(() =>
  filterDirectoryChats({
    chatFilter: chatFilter.value,
    chatListMode: chatListMode.value,
    chats: directoryState.chats.value,
    folderId: chatFolderId.value,
    selectedChatId: selectedChatId.value
  })
);
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
  primaryResolvedItems.value.map(clientTabFromItem).filter(isDefined).sort(compareClientTabs)
);
const defaultPrimaryTab = computed(() => primaryTabs.value[0] ?? null);
const routedPrimaryTab = computed(() => {
  const routeSegment = routePrimaryTabSegment.value;
  return routeSegment === null
    ? null
    : (primaryTabs.value.find((tab) => tab.routeSegment === routeSegment) ?? null);
});
const activePrimaryTab = computed(() => {
  const routedTab = routedPrimaryTab.value;
  if (routedTab !== null) {
    return routedTab;
  }
  return defaultPrimaryTab.value;
});
const activePrimaryTabId = computed(() => activePrimaryTab.value?.item.contentId ?? '');
const selectedChat = computed(() =>
  selectedChatId.value === null
    ? null
    : (directoryState.chats.value.find((chat) => chat.id === selectedChatId.value) ?? null)
);
const selectedChatAvatarUrl = computed(() =>
  selectedChat.value === null
    ? null
    : providerFileUrl(
        selectedChat.value.avatar.small?.url ?? selectedChat.value.avatar.big?.url ?? null
      )
);
const selectedChatHeader = computed(() =>
  buildChatHeaderView(selectedChat.value, selectedChatAvatarUrl.value)
);
const activePrimaryTabRoute = computed(() =>
  routedPrimaryTab.value !== null && !isDefaultPrimaryTab(routedPrimaryTab.value)
    ? selectedChatRoute.value.child(1)
    : selectedChatRoute.value
);
const nestedRouteContext = computed(() => activePrimaryTabRoute.value.context);
const nestedSlotContext = computed(() => ({
  ...nestedRouteContext.value,
  closeSelectedChat,
  selectedChatAvatarUrl: selectedChatAvatarUrl.value,
  selectedChatId: selectedChatId.value
}));

watch(
  routeChatId,
  (chatId) => {
    if (selectedChatId.value !== chatId) {
      selectedChatId.value = chatId;
    }
  },
  { immediate: true }
);

watch(
  selectedChatId,
  (chatId) => {
    writeStorage(`${telegramStoragePrefix}.selectedChatId`, chatId ?? '');
    writeSelectedChatRoute(chatId);
  },
  { immediate: true }
);

watch(
  () => ({
    chats: directoryState.chats.value,
    hydrated: directoryState.hydrated.value,
    selectedChatId: selectedChatId.value
  }),
  selectSelectedChatListFromDirectory,
  { immediate: true }
);

watch(
  () => ({
    hydrated: directoryState.hydrated.value,
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
  () => ({
    chatId: selectedChatId.value,
    routeChatId: routeChatId.value,
    routeTabSegment: routePrimaryTabSegment.value,
    tab: activePrimaryTab.value
  }),
  normalizePrimaryTabRoute,
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
  const tab = primaryTabs.value.find((item) => item.item.contentId === contentId);
  if (tab === undefined || selectedChatId.value === null) {
    return;
  }
  route.value.replace(clientRouteSegmentsForChat(selectedChatId.value, routeSegmentForTab(tab)));
}

function setPrimaryItemState(item: SlotItemResolution, state: SlotItemRenderState): void {
  primaryItemStates.value = new Map(primaryItemStates.value).set(slotItemKey(item), state);
}

function setActivePrimaryItemState(state: SlotItemRenderState): void {
  const tab = activePrimaryTab.value;
  if (tab === null) {
    return;
  }
  setPrimaryItemState(tab.item, state);
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
  const chat = directoryState.chats.value.find((item) => item.id === chatId);
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

function initialSelectedChatId(): string | null {
  return routeChatId.value;
}

function writeSelectedChatRoute(chatId: string | null): void {
  if (routeChatId.value === chatId) {
    return;
  }
  route.value.replace(clientRouteSegmentsForChat(chatId, routeSegmentForCurrentRoute()));
}

function normalizePrimaryTabRoute(): void {
  const chatId = selectedChatId.value;
  const tab = activePrimaryTab.value;
  if (chatId === null || tab === null || routeChatId.value !== chatId) {
    return;
  }
  if (routedPrimaryTab.value !== null && isDefaultPrimaryTab(routedPrimaryTab.value)) {
    route.value.replace(clientRouteSegmentsForChat(chatId, null, selectedChatRoute.value.rest(1)));
    return;
  }
  const routeSegment = routeSegmentForTab(tab);
  if (routeSegment !== null && routePrimaryTabSegment.value !== routeSegment) {
    route.value.replace(clientRouteSegmentsForChat(chatId, routeSegment));
  }
}

function routeSegmentForTab(tab: ClientTab | null): string | null {
  return tab === null || isDefaultPrimaryTab(tab) ? null : tab.routeSegment;
}

function routeSegmentForCurrentRoute(): string | null {
  const routedTab = routedPrimaryTab.value;
  return routedTab === null ? routePrimaryTabSegment.value : routeSegmentForTab(routedTab);
}

function isDefaultPrimaryTab(tab: ClientTab): boolean {
  return tab.item.contentId === defaultPrimaryTab.value?.item.contentId;
}

function selectSelectedChatListFromDirectory(): void {
  const chatId = selectedChatId.value;
  if (!directoryState.hydrated.value || chatId === null) {
    return;
  }
  const chat = directoryState.chats.value.find((item) => item.id === chatId);
  if (chat !== undefined) {
    selectChatList(preferredChatListSelection(chat));
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

function ensureSelectedFolderExists(): void {
  if (!directoryState.hydrated.value) {
    return;
  }
  if (normalizedChatQuery(chatFilter.value).length === 0 && chatListMode.value === 'folder') {
    if (!hasChatFolder(chatFolderId.value)) {
      selectMainChatList();
    }
  }
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

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isDefined<T>(value: T | undefined): value is T {
  return value !== undefined;
}
</script>

<template>
  <div class="telegram-client">
    <section
      class="telegram-client__chat-interface"
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

      <ChatSidebarResizer
        :max-width="chatSidebarMaxWidth"
        :min-width="chatSidebarMinWidth"
        :width="chatSidebarWidth"
        @keyboard-resize="resizeChatSidebarWithKeyboard"
        @resize-start="startChatSidebarResize"
      />

      <ClientPrimaryPanel
        :active-tab="activePrimaryTab"
        :active-tab-id="activePrimaryTabId"
        :chat-header="selectedChatHeader"
        :content-attrs="emptyContentAttrs"
        :selected-chat-id="selectedChatId"
        :slot-context="nestedSlotContext"
        :tabs="primaryTabs"
        @close-chat="closeSelectedChat"
        @select-tab="selectPrimaryTab"
        @state-change="setActivePrimaryItemState"
      />
    </section>
  </div>
</template>

<style scoped>
@reference "tailwindcss";

.telegram-client {
  @apply h-full min-h-0 w-full flex-1 overflow-hidden;
}

.telegram-client__chat-interface {
  @apply relative grid h-full min-h-0 w-full min-w-0 grid-cols-[var(--telegram-chat-sidebar-width)_minmax(0,1fr)] overflow-hidden rounded-lg border border-zinc-200 bg-white;
}

.telegram-client__chat-interface[data-resizing='true'] {
  @apply cursor-col-resize select-none;
}
</style>
