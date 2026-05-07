import type { ControlPlaneActions } from '@agentg/control-plane-extension/actions';
import { onBeforeUnmount, onMounted } from 'vue';

import {
  createControlPlaneClient,
  type ControlPlaneEvent
} from '../control-plane/controlPlaneClient.js';
import { createControlPlaneApi } from '../control-plane/controlPlaneApi.js';
import type {
  ChatListMode,
  ChatPlacement,
  ControlPlaneChat,
  StatusBadgeKind
} from '../stores/controlPlaneTypes.js';
import { useAppShellStore } from '../stores/appShell.js';
import { useChatStore } from '../stores/chat.js';
import { useEventsStore } from '../stores/events.js';
import { useOverviewStore } from '../stores/overview.js';
import { useSelectedHistoryStore } from '../stores/selectedHistory.js';

type ChatListSelection = {
  folderId: number | null;
  mode: ChatListMode;
};

export function useControlPlaneRuntime() {
  const appShellStore = useAppShellStore();
  const chatStore = useChatStore();
  const eventsStore = useEventsStore();
  const overviewStore = useOverviewStore();
  const selectedHistoryStore = useSelectedHistoryStore();
  let runtimeStarted = false;
  let refreshTimer: ReturnType<typeof setTimeout> | null = null;
  let tdlibConnected = false;
  let lastTdlibStatusAt: Date | null = null;
  let tdlibStatusWatchdog: ReturnType<typeof setInterval> | null = null;
  const tdlibStatusStartedAt = Date.now();

  const controlPlane = createControlPlaneClient({
    onClose() {
      if (runtimeStarted) {
        setControlPlaneStatus('bad');
      }
    },
    onEvent(event) {
      if (runtimeStarted) {
        receiveEvent(event);
      }
    },
    onOpen() {
      if (!runtimeStarted) {
        return;
      }
      setControlPlaneStatus('ok');
      void Promise.all([loadOverview(), loadChats()])
        .then(async () => {
          if (selectedHistoryStore.selectedChatId) {
            await loadSelectedState();
          }
        })
        .catch(showError);
    }
  });
  const controlPlaneApi = createControlPlaneApi(controlPlane);

  async function loadOverview(): Promise<void> {
    overviewStore.setOverview(await controlPlaneApi.getOverview());
  }

  async function loadChats(options: { focusChatId?: string } = {}): Promise<void> {
    const query = chatStore.chatFilter.trim();
    const request = {
      folderId: chatStore.chatFolderId,
      listMode: chatStore.chatListMode,
      query
    };
    const result = await controlPlaneApi.listChats(
      options.focusChatId === undefined
        ? request
        : {
            ...request,
            focusChatId: options.focusChatId
          }
    );
    chatStore.setChatListData({
      chats: result.chats,
      navigation: result.navigation
    });
    if (
      query.length === 0 &&
      chatStore.chatListMode === 'folder' &&
      !chatStore.hasChatFolder(chatStore.chatFolderId)
    ) {
      chatStore.selectMainChatList();
      await loadChats();
    }
  }

  async function loadSelectedState(): Promise<void> {
    const selectedChatId = selectedHistoryStore.selectedChatId;
    if (!selectedChatId) {
      return;
    }
    selectedHistoryStore.markSelectedHistoryLoading();
    try {
      const selectedState = await controlPlaneApi.getChatHistoryState(selectedChatId);
      if (selectedHistoryStore.selectedChatId !== selectedChatId) {
        return;
      }
      selectedHistoryStore.setSelectedHistoryState(selectedState);
    } catch (error) {
      if (selectedHistoryStore.selectedChatId !== selectedChatId) {
        return;
      }
      if (isNotFoundLikeError(error)) {
        clearSelectedChat();
        await loadChats();
        return;
      }
      throw error;
    }
    if (!selectedHistoryStore.selectedHistoryState?.chat) {
      clearSelectedChat();
      await loadChats();
    }
  }

  async function upsertPresetTarget(preset: string): Promise<void> {
    const chatId = selectedHistoryStore.selectedChatId;
    if (!chatId) {
      return;
    }
    await controlPlaneApi.upsertPresetTarget(chatId, preset);
  }

  async function upsertCustomTarget(start: string, end: string): Promise<void> {
    const chatId = selectedHistoryStore.selectedChatId;
    if (!chatId) {
      return;
    }
    await controlPlaneApi.upsertCustomTarget(chatId, start, end);
  }

  async function deleteHistoryTarget(targetId: string): Promise<void> {
    if (!targetId) {
      return;
    }
    await controlPlaneApi.deleteTarget(targetId);
  }

  function receiveEvent(event: ControlPlaneEvent): void {
    if (event.type === 'telegram.status') {
      receiveTdlibStatus(event);
    }
    selectedHistoryStore.applyTimelineEvent(event);
    if (event.type) {
      eventsStore.pushEvent(event);
    }
  }

  function receiveTdlibStatus(event: ControlPlaneEvent): void {
    const data = isPlainRecord(event.data) ? event.data : {};
    tdlibConnected = data.connected === true;
    lastTdlibStatusAt = new Date(event.occurredAt ?? Date.now());
    updateTdlibStatus();
  }

  async function openMainChats(): Promise<void> {
    chatStore.selectMainChatList();
    await loadChats();
  }

  async function openArchiveChats(): Promise<void> {
    chatStore.selectArchiveChatList();
    await loadChats();
  }

  async function openFolderChats(folderId: number): Promise<void> {
    if (!Number.isSafeInteger(folderId)) {
      return;
    }
    chatStore.selectFolderChatList(folderId);
    await loadChats();
  }

  async function openChat(chatId: string): Promise<void> {
    const normalizedChatId = chatId.trim();
    if (normalizedChatId.length === 0) {
      return;
    }

    const chat = await findChatById(normalizedChatId);
    selectChatList(preferredChatListSelection(chat));
    await loadChats({ focusChatId: normalizedChatId });
    if (!chatStore.chats.some((item) => item.id === normalizedChatId)) {
      throw new Error(`Chat ${normalizedChatId} is not visible in its Telegram list`);
    }
    selectedHistoryStore.selectChat(normalizedChatId);
    await loadSelectedState();
  }

  async function toggleChat(chatId: string): Promise<void> {
    if (selectedHistoryStore.selectedChatId === chatId) {
      clearSelectedChat();
      return;
    }
    selectedHistoryStore.selectChat(chatId);
    await loadSelectedState();
  }

  async function findChatById(chatId: string): Promise<ControlPlaneChat> {
    const result = await controlPlaneApi.listChats({
      folderId: null,
      listMode: 'main',
      query: chatId
    });
    const chat = result.chats.find((item) => item.id === chatId);
    if (chat === undefined) {
      throw new Error(`Chat ${chatId} is not available in the chat directory`);
    }
    return chat;
  }

  function preferredChatListSelection(chat: ControlPlaneChat): ChatListSelection {
    const placement = [...chat.placements].sort(compareChatPlacements)[0];
    if (placement === undefined) {
      throw new Error(`Chat ${chat.id} has no Telegram list placement`);
    }
    if (placement.kind === 'folder') {
      return { folderId: placement.folderId, mode: 'folder' };
    }
    return { folderId: null, mode: placement.kind };
  }

  function selectChatList(selection: ChatListSelection): void {
    if (selection.mode === 'main') {
      chatStore.selectMainChatList();
      return;
    }
    if (selection.mode === 'archive') {
      chatStore.selectArchiveChatList();
      return;
    }
    if (selection.folderId !== null) {
      chatStore.selectFolderChatList(selection.folderId);
    }
  }

  function searchChats(value: string): void {
    chatStore.setChatFilter(value);
    clearRefreshTimer();
    refreshTimer = setTimeout(() => {
      void loadChats().catch(showError);
    }, 250);
  }

  function clearChatSearch(): void {
    chatStore.clearChatFilter();
    clearRefreshTimer();
    void loadChats().catch(showError);
  }

  function setControlPlaneStatus(kind: StatusBadgeKind): void {
    appShellStore.setControlPlaneStatus(kind);
  }

  function setTdlibStatus(kind: StatusBadgeKind): void {
    appShellStore.setTdlibStatus(kind);
  }

  function updateTdlibStatus(): void {
    const now = Date.now();
    if (!lastTdlibStatusAt) {
      setTdlibStatus(now - tdlibStatusStartedAt > 15000 ? 'bad' : 'warn');
      return;
    }

    const age = now - lastTdlibStatusAt.getTime();
    setTdlibStatus(tdlibConnected && age <= 15000 ? 'ok' : 'bad');
  }

  function startTdlibStatusWatchdog(): void {
    updateTdlibStatus();
    tdlibStatusWatchdog = setInterval(updateTdlibStatus, 1000);
  }

  function showError(error: unknown): void {
    if (selectedHistoryStore.selectedChatId && isNotFoundLikeError(error)) {
      clearSelectedChat();
      void Promise.all([loadOverview(), loadChats()]).catch((refreshError: unknown) => {
        pushLocalError(refreshError);
      });
      return;
    }
    pushLocalError(error);
  }

  function pushLocalError(error: unknown): void {
    eventsStore.pushEvent({
      data: { message: errorMessage(error) },
      occurredAt: new Date().toISOString(),
      type: 'ui.error'
    });
  }

  function clearSelectedChat(): void {
    selectedHistoryStore.clearSelectedChat();
  }

  function startRuntime(): void {
    if (runtimeStarted) {
      return;
    }
    runtimeStarted = true;
    startTdlibStatusWatchdog();
    controlPlane.connect();
  }

  function stopRuntime(): void {
    if (!runtimeStarted) {
      return;
    }
    runtimeStarted = false;
    clearRefreshTimer();
    if (tdlibStatusWatchdog !== null) {
      clearInterval(tdlibStatusWatchdog);
      tdlibStatusWatchdog = null;
    }
    controlPlane.disconnect();
  }

  function clearRefreshTimer(): void {
    if (refreshTimer !== null) {
      clearTimeout(refreshTimer);
      refreshTimer = null;
    }
  }

  const actions: ControlPlaneActions = {
    addCustomTarget(start, end) {
      void upsertCustomTarget(start, end).catch(showError);
    },
    addPresetTarget(preset) {
      void upsertPresetTarget(preset).catch(showError);
    },
    clearTimelineScale() {
      selectedHistoryStore.setViewportDays(null);
    },
    clearChatSearch,
    closeSelectedChat() {
      clearSelectedChat();
    },
    deleteTarget(targetId) {
      void deleteHistoryTarget(targetId).catch(showError);
    },
    openArchiveChats() {
      void openArchiveChats().catch(showError);
    },
    openChat(chatId) {
      void openChat(chatId).catch(showError);
    },
    openFolderChats(folderId) {
      void openFolderChats(folderId).catch(showError);
    },
    openMainChats() {
      void openMainChats().catch(showError);
    },
    searchChats,
    selectTimelineScale(value) {
      if (selectedHistoryStore.viewportDays === value) {
        selectedHistoryStore.setDefaultViewportDays(value);
      }
      selectedHistoryStore.setViewportDays(value);
    },
    toggleChat(chatId) {
      void toggleChat(chatId).catch(showError);
    }
  };

  onMounted(startRuntime);
  onBeforeUnmount(stopRuntime);

  return actions;
}

function compareChatPlacements(left: ChatPlacement, right: ChatPlacement): number {
  const leftRank = chatPlacementRank(left);
  const rightRank = chatPlacementRank(right);
  if (leftRank !== rightRank) {
    return leftRank - rightRank;
  }

  const orderComparison = compareBigIntDescending(
    parsePositiveBigInt(left.order),
    parsePositiveBigInt(right.order)
  );
  if (orderComparison !== 0) {
    return orderComparison;
  }

  const leftFolderId = left.kind === 'folder' ? left.folderId : 0;
  const rightFolderId = right.kind === 'folder' ? right.folderId : 0;
  return leftFolderId - rightFolderId;
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

function compareBigIntDescending(left: bigint, right: bigint): number {
  if (left === right) {
    return 0;
  }
  return left > right ? -1 : 1;
}

function parsePositiveBigInt(value: string): bigint {
  return /^[0-9]+$/.test(value) ? BigInt(value) : 0n;
}

function isNotFoundLikeError(error: unknown): boolean {
  return /not found|not available|unknown chat|данные не найдены/i.test(errorMessage(error));
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  return String(error);
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
