import { computed, ref, type CSSProperties } from 'vue';

import { readStorage, writeStorage } from './storage.js';

const CHAT_SIDEBAR_DEFAULT_WIDTH = 380;
export const CHAT_SIDEBAR_MAX_WIDTH = 560;
export const CHAT_SIDEBAR_MIN_WIDTH = 300;

type BrowserGlobal = {
  addEventListener(
    type: 'pointermove' | 'pointerup',
    listener: (event: PointerResizeEvent) => void,
    options?: { once: boolean }
  ): void;
  removeEventListener(
    type: 'pointermove' | 'pointerup',
    listener: (event: PointerResizeEvent) => void
  ): void;
};

type KeyboardResizeEvent = {
  key: string;
  preventDefault(): void;
};

type PointerResizeEvent = {
  clientX: number;
  preventDefault(): void;
};

export function useChatSidebarResize(storageKey: string) {
  const width = ref(readStoredWidth(storageKey));
  const resizing = ref(false);
  const style = computed<CSSProperties>(() => ({
    '--telegram-chat-sidebar-width': `${String(width.value)}px`
  }));
  let resizeStartX = 0;
  let resizeStartWidth = CHAT_SIDEBAR_DEFAULT_WIDTH;

  function start(event: PointerResizeEvent): void {
    resizeStartX = event.clientX;
    resizeStartWidth = width.value;
    resizing.value = true;
    browserGlobal().addEventListener('pointermove', resize);
    browserGlobal().addEventListener('pointerup', finish, { once: true });
    event.preventDefault();
  }

  function resize(event: PointerResizeEvent): void {
    width.value = clampWidth(resizeStartWidth + Math.round(event.clientX - resizeStartX));
  }

  function finish(): void {
    stop();
    writeStorage(storageKey, String(width.value));
  }

  function stop(): void {
    if (!resizing.value) {
      return;
    }
    resizing.value = false;
    browserGlobal().removeEventListener('pointermove', resize);
    browserGlobal().removeEventListener('pointerup', finish);
  }

  function resizeWithKeyboard(event: KeyboardResizeEvent): void {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') {
      return;
    }
    const direction = event.key === 'ArrowLeft' ? -1 : 1;
    width.value = clampWidth(width.value + direction * 16);
    writeStorage(storageKey, String(width.value));
    event.preventDefault();
  }

  return {
    maxWidth: CHAT_SIDEBAR_MAX_WIDTH,
    minWidth: CHAT_SIDEBAR_MIN_WIDTH,
    resizeWithKeyboard,
    resizing,
    start,
    stop,
    style,
    width
  };
}

function browserGlobal(): BrowserGlobal {
  return globalThis as unknown as BrowserGlobal;
}

function clampWidth(value: number): number {
  if (!Number.isFinite(value)) {
    return CHAT_SIDEBAR_DEFAULT_WIDTH;
  }
  return Math.min(CHAT_SIDEBAR_MAX_WIDTH, Math.max(CHAT_SIDEBAR_MIN_WIDTH, value));
}

function readStoredWidth(storageKey: string): number {
  const raw = readStorage(storageKey);
  const parsed = raw === null ? Number.NaN : Number.parseInt(raw, 10);
  return clampWidth(parsed);
}
