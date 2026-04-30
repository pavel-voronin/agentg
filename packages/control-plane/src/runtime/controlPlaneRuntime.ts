import { onBeforeUnmount, onMounted } from 'vue';

import { createGatewayClient, type GatewayEvent } from '../gateway/gatewayClient.js';
import { createHistoryApi } from '../gateway/historyApi.js';
import {
  controlPlaneStore,
  type ControlPlaneStore,
  type StatusBadgeKind
} from '../stores/controlPlaneStore.js';

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

export function useControlPlaneRuntime(appStore: ControlPlaneStore = controlPlaneStore) {
  let runtimeStarted = false;
  let refreshTimer: ReturnType<typeof setTimeout> | null = null;
  let tdlibConnected = false;
  let lastTdlibStatusAt: Date | null = null;
  let tdlibStatusWatchdog: ReturnType<typeof setInterval> | null = null;
  const tdlibStatusStartedAt = Date.now();

  const gateway = createGatewayClient({
    onClose() {
      if (runtimeStarted) {
        setGatewayStatus('bad');
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
      setGatewayStatus('ok');
      void refreshAll().catch(showError);
    }
  });
  const historyApi = createHistoryApi(gateway);

  async function refreshAll(): Promise<void> {
    await Promise.all([loadOverview(), loadChats()]);
    if (appStore.state.selectedChatId) {
      await loadSelectedState();
    }
  }

  async function loadOverview(): Promise<void> {
    appStore.setOverview(await historyApi.getOverview());
  }

  async function loadChats(): Promise<void> {
    const query = appStore.state.chatFilter.trim();
    const result = await historyApi.listChats({
      folderId: appStore.state.chatFolderId,
      listMode: appStore.state.chatListMode,
      query
    });
    appStore.setChatListData({
      chats: result.chats,
      navigation: result.navigation
    });
    if (
      query.length === 0 &&
      appStore.state.chatListMode === 'folder' &&
      !appStore.hasChatFolder(appStore.state.chatFolderId)
    ) {
      appStore.selectMainChatList();
      await loadChats();
    }
  }

  async function loadSelectedState(): Promise<void> {
    const selectedChatId = appStore.state.selectedChatId;
    if (!selectedChatId) {
      return;
    }
    appStore.markSelectedHistoryLoading();
    try {
      const selectedState = await historyApi.getChatHistoryState(selectedChatId);
      if (appStore.state.selectedChatId !== selectedChatId) {
        return;
      }
      appStore.setSelectedHistoryState(selectedState);
    } catch (error) {
      if (appStore.state.selectedChatId !== selectedChatId) {
        return;
      }
      if (isNotFoundLikeError(error)) {
        clearSelectedChat();
        await loadChats();
        return;
      }
      throw error;
    }
    if (!appStore.state.selectedHistoryState?.chat) {
      clearSelectedChat();
      await loadChats();
    }
  }

  async function upsertPresetTarget(preset: string): Promise<void> {
    const chatId = appStore.state.selectedChatId;
    if (!chatId) {
      return;
    }
    await historyApi.upsertPresetTarget(chatId, preset);
    await refreshAll();
  }

  async function upsertCustomTarget(start: string, end: string): Promise<void> {
    const chatId = appStore.state.selectedChatId;
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

  function receiveEvent(event: GatewayEvent): void {
    if (event.type === 'telegram.tdlib.status') {
      receiveTdlibStatus(event);
    }
    if (event.type) {
      appStore.pushEvent(event);
    }
    if (shouldRefreshForEvent(event)) {
      debounceRefresh();
    }
  }

  function receiveTdlibStatus(event: GatewayEvent): void {
    const data = isPlainRecord(event.data) ? event.data : {};
    tdlibConnected = data.connected === true;
    lastTdlibStatusAt = new Date(event.occurredAt ?? Date.now());
    updateTdlibStatus();
  }

  function shouldRefreshForEvent(event: GatewayEvent): boolean {
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
    appStore.selectMainChatList();
    await loadChats();
  }

  async function openArchiveChats(): Promise<void> {
    appStore.selectArchiveChatList();
    await loadChats();
  }

  async function openFolderChats(folderId: number): Promise<void> {
    if (!Number.isSafeInteger(folderId)) {
      return;
    }
    appStore.selectFolderChatList(folderId);
    await loadChats();
  }

  async function toggleChat(chatId: string): Promise<void> {
    if (appStore.state.selectedChatId === chatId) {
      clearSelectedChat();
      return;
    }
    appStore.selectChat(chatId);
    await loadSelectedState();
  }

  function searchChats(value: string): void {
    appStore.setChatFilter(value);
    clearRefreshTimer();
    refreshTimer = setTimeout(() => {
      void loadChats().catch(showError);
    }, 250);
  }

  function clearChatSearch(): void {
    appStore.clearChatFilter();
    clearRefreshTimer();
    void loadChats().catch(showError);
  }

  function setGatewayStatus(kind: StatusBadgeKind): void {
    appStore.setGatewayStatus(kind);
  }

  function setTdlibStatus(kind: StatusBadgeKind): void {
    appStore.setTdlibStatus(kind);
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
    if (appStore.state.selectedChatId && isNotFoundLikeError(error)) {
      clearSelectedChat();
      void refreshAll().catch((refreshError: unknown) => {
        pushLocalError(refreshError);
      });
      return;
    }
    pushLocalError(error);
  }

  function pushLocalError(error: unknown): void {
    appStore.pushEvent({
      data: { message: errorMessage(error) },
      occurredAt: new Date().toISOString(),
      type: 'ui.error'
    });
  }

  function clearSelectedChat(): void {
    appStore.clearSelectedChat();
  }

  function startRuntime(): void {
    if (runtimeStarted) {
      return;
    }
    runtimeStarted = true;
    startTdlibStatusWatchdog();
    gateway.connect();
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
    gateway.disconnect();
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
