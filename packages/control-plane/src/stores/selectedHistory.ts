import { acceptHMRUpdate, defineStore } from 'pinia';

import { CONTROL_PLANE_STORAGE_KEYS, readStorage, writeStorage } from './controlPlaneStorage.js';
import {
  DEFAULT_VIEWPORT_DAYS,
  type SelectedHistoryState,
  type SelectedHistoryStatus
} from './controlPlaneTypes.js';

type SelectedHistoryStoreState = {
  defaultViewportDays: number;
  selectedChatId: string | null;
  selectedHistoryState: SelectedHistoryState | null;
  selectedHistoryStatus: SelectedHistoryStatus;
  viewportDays: number | null;
};

export const useSelectedHistoryStore = defineStore('controlPlane.selectedHistory', {
  actions: {
    clearSelectedChat() {
      this.selectedChatId = null;
      this.selectedHistoryState = null;
      this.selectedHistoryStatus = 'idle';
      writeStorage(CONTROL_PLANE_STORAGE_KEYS.selectedChatId, '');
    },
    clearSelectedHistoryState() {
      this.selectedHistoryState = null;
      this.selectedHistoryStatus = this.selectedChatId === null ? 'idle' : 'loading';
    },
    markSelectedHistoryLoading() {
      if (this.selectedChatId === null) {
        this.selectedHistoryState = null;
        this.selectedHistoryStatus = 'idle';
        return;
      }
      if (this.selectedHistoryState?.chat) {
        this.selectedHistoryStatus = 'ready';
        return;
      }
      this.selectedHistoryState = null;
      this.selectedHistoryStatus = 'loading';
    },
    selectChat(chatId: string) {
      this.selectedChatId = chatId;
      this.selectedHistoryState = null;
      this.selectedHistoryStatus = 'loading';
      this.viewportDays = this.defaultViewportDays;
      writeStorage(CONTROL_PLANE_STORAGE_KEYS.selectedChatId, chatId);
    },
    setDefaultViewportDays(value: number) {
      this.defaultViewportDays = normalizeViewportDays(value);
      writeStorage(
        CONTROL_PLANE_STORAGE_KEYS.defaultViewportDays,
        String(this.defaultViewportDays)
      );
    },
    setSelectedHistoryState(selectedState: SelectedHistoryState | null) {
      this.selectedHistoryState = selectedState;
      this.selectedHistoryStatus = selectedState?.chat ? 'ready' : 'unavailable';
    },
    setSelectedHistoryUnavailable() {
      this.selectedHistoryState = null;
      this.selectedHistoryStatus = this.selectedChatId === null ? 'idle' : 'unavailable';
    },
    setViewportDays(value: number | null) {
      this.viewportDays = value === null ? null : normalizeViewportDays(value);
    }
  },
  state: (): SelectedHistoryStoreState => ({
    defaultViewportDays: readStoredViewportDays(),
    selectedChatId: readSelectedChatId(),
    selectedHistoryState: null,
    selectedHistoryStatus: 'idle',
    viewportDays: readStoredViewportDays()
  })
});

export function normalizeViewportDays(value: number | string): number {
  const days = Number(value);
  if (!Number.isFinite(days)) {
    return DEFAULT_VIEWPORT_DAYS;
  }
  return Math.max(0, Math.round(days));
}

function readSelectedChatId(): string | null {
  const value = readStorage(CONTROL_PLANE_STORAGE_KEYS.selectedChatId);
  return value === null || value.length === 0 ? null : value;
}

function readStoredViewportDays(): number {
  return normalizeViewportDays(
    readStorage(CONTROL_PLANE_STORAGE_KEYS.defaultViewportDays) ?? DEFAULT_VIEWPORT_DAYS
  );
}

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useSelectedHistoryStore, import.meta.hot));
}
