import { onBeforeUnmount, onMounted } from 'vue';

import {
  createControlPlaneClient,
  type ControlPlaneEvent
} from '../control-plane/controlPlaneClient.js';
import { createHistoryApi } from '../control-plane/historyApi.js';
import type { StatusBadgeKind } from '../stores/controlPlaneTypes.js';
import { useAppShellStore } from '../stores/appShell.js';
import { useChatStore } from '../stores/chat.js';
import { useEventsStore } from '../stores/events.js';
import { useOverviewStore } from '../stores/overview.js';
import { useSelectedHistoryStore } from '../stores/selectedHistory.js';

export type ControlPlaneActions = {
  addCustomTarget: (start: string, end: string) => void;
  addPresetTarget: (preset: string) => void;
  clearChatSearch: () => void;
  closeSelectedChat: () => void;
  deleteTarget: (targetId: string) => void;
  openArchiveChats: () => void;
  openFolderChats: (folderId: number) => void;
  openMainChats: () => void;
  searchChats: (value: string) => void;
  toggleChat: (chatId: string) => void;
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
      void refreshAll().catch(showError);
    }
  });
  const historyApi = createHistoryApi(controlPlane);

  async function refreshAll(): Promise<void> {
    await Promise.all([loadOverview(), loadChats()]);
    if (selectedHistoryStore.selectedChatId) {
      await loadSelectedState();
    }
  }

  async function loadOverview(): Promise<void> {
    overviewStore.setOverview(await historyApi.getOverview());
  }

  async function loadChats(): Promise<void> {
    const query = chatStore.chatFilter.trim();
    const result = await historyApi.listChats({
      folderId: chatStore.chatFolderId,
      listMode: chatStore.chatListMode,
      query
    });
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
      const selectedState = await historyApi.getChatHistoryState(selectedChatId);
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
    await historyApi.upsertPresetTarget(chatId, preset);
    await refreshAll();
  }

  async function upsertCustomTarget(start: string, end: string): Promise<void> {
    const chatId = selectedHistoryStore.selectedChatId;
    if (!chatId) {
      return;
    }
    await historyApi.upsertCustomTarget(chatId, start, end);
    await refreshAll();
  }

  async function deleteHistoryTarget(targetId: string): Promise<void> {
    if (!targetId) {
      return;
    }
    await historyApi.deleteTarget(targetId);
    await refreshAll();
  }

  function receiveEvent(event: ControlPlaneEvent): void {
    if (event.type === 'telegram.tdlib.status') {
      receiveTdlibStatus(event);
    }
    if (event.type) {
      eventsStore.pushEvent(event);
    }
    if (shouldRefreshForEvent(event)) {
      debounceRefresh();
    }
  }

  function receiveTdlibStatus(event: ControlPlaneEvent): void {
    const data = isPlainRecord(event.data) ? event.data : {};
    tdlibConnected = data.connected === true;
    lastTdlibStatusAt = new Date(event.occurredAt ?? Date.now());
    updateTdlibStatus();
  }

  function shouldRefreshForEvent(event: ControlPlaneEvent): boolean {
    return (
      event.type?.startsWith('history.') === true ||
      event.type === 'telegram.chat.updated' ||
      event.type === 'telegram.chat_folders.updated'
    );
  }

  function debounceRefresh(): void {
    clearRefreshTimer();
    refreshTimer = setTimeout(() => {
      void refreshAll().catch(showError);
    }, 350);
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

  async function toggleChat(chatId: string): Promise<void> {
    if (selectedHistoryStore.selectedChatId === chatId) {
      clearSelectedChat();
      return;
    }
    selectedHistoryStore.selectChat(chatId);
    await loadSelectedState();
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
      void refreshAll().catch((refreshError: unknown) => {
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
    openFolderChats(folderId) {
      void openFolderChats(folderId).catch(showError);
    },
    openMainChats() {
      void openMainChats().catch(showError);
    },
    searchChats,
    toggleChat(chatId) {
      void toggleChat(chatId).catch(showError);
    }
  };

  onMounted(startRuntime);
  onBeforeUnmount(stopRuntime);

  return actions;
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
