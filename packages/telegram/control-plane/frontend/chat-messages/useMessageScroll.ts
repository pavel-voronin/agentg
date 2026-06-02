import { ref, type ComponentPublicInstance, type Ref } from 'vue';

type BrowserElement = {
  clientHeight: number;
  closest?: (selector: string) => BrowserElement | null;
  contains(value: BrowserElement): boolean;
  dataset?: Record<string, string | undefined>;
  getBoundingClientRect(): {
    bottom: number;
    left: number;
    top: number;
    width: number;
  };
  scrollHeight: number;
  scrollIntoView(options?: { block?: 'center' }): void;
  scrollTop: number;
};

type BrowserGlobals = {
  HTMLElement: new (...args: never[]) => BrowserElement;
  cancelAnimationFrame(id: number): void;
  document: {
    elementFromPoint(x: number, y: number): BrowserElement | null;
  };
  requestAnimationFrame(callback: () => void): number;
};

const LOAD_OLDER_EDGE_PX = 160;
const AUTO_SCROLL_BOTTOM_PX = 180;
const SCROLL_BOTTOM_EPSILON_PX = 2;
const DATE_ISLAND_HIDE_DELAY_MS = 1000;
const DATE_ISLAND_SAMPLE_OFFSETS = [12, 40, 80] as const;
const highlightDurationMs = 1600;

export type MessageScroll = {
  floatingDateLabel: Ref<string | null>;
  floatingDateVisible: Ref<boolean>;
  highlightedMessageId: Ref<string | null>;
  isNearBottom(): boolean;
  onScroll(): void;
  resetScrollState(): void;
  scrollRoot: Ref<BrowserElement | null>;
  scrollToBottom(): void;
  scrollToMessage(messageId: string): void;
  setMessageElement(messageId: string, value: unknown): void;
  setScrollRoot(value: unknown): void;
  showScrollDown: Ref<boolean>;
  stop(): void;
  updateScrollDownVisibility(): void;
};

export function useMessageScroll(options: { loadOlder(): void }): MessageScroll {
  const scrollRoot = ref<BrowserElement | null>(null);
  const showScrollDown = ref(false);
  const floatingDateLabel = ref<string | null>(null);
  const floatingDateVisible = ref(false);
  const highlightedMessageId = ref<string | null>(null);
  const messageElements = new Map<string, BrowserElement>();

  let highlightTimeout: ReturnType<typeof setTimeout> | null = null;
  let dateIslandHideTimeout: ReturnType<typeof setTimeout> | null = null;
  let dateIslandFrame: number | null = null;

  function onScroll(): void {
    updateScrollDownVisibility();
    showFloatingDateIsland();
    const root = scrollRoot.value;
    if (root !== null && root.scrollTop <= LOAD_OLDER_EDGE_PX) {
      options.loadOlder();
    }
  }

  function scrollToBottom(): void {
    const root = scrollRoot.value;
    if (root === null) {
      return;
    }
    root.scrollTop = root.scrollHeight;
    updateScrollDownVisibility();
  }

  function scrollToMessage(messageId: string): void {
    const element = messageElements.get(messageId);
    if (element === undefined) {
      return;
    }
    element.scrollIntoView({ block: 'center' });
    highlightedMessageId.value = messageId;
    clearHighlightTimeout();
    highlightTimeout = setTimeout(() => {
      highlightedMessageId.value = null;
      highlightTimeout = null;
    }, highlightDurationMs);
  }

  function setMessageElement(messageId: string, value: unknown): void {
    const element = browserElementFromRef(value);
    if (element === null) {
      messageElements.delete(messageId);
      return;
    }
    messageElements.set(messageId, element);
  }

  function setScrollRoot(value: unknown): void {
    scrollRoot.value = browserElementFromRef(value);
  }

  function updateScrollDownVisibility(): void {
    showScrollDown.value = !isAtBottom();
  }

  function isNearBottom(): boolean {
    const root = scrollRoot.value;
    if (root === null) {
      return true;
    }
    return root.scrollHeight - root.scrollTop - root.clientHeight <= AUTO_SCROLL_BOTTOM_PX;
  }

  function resetScrollState(): void {
    messageElements.clear();
    showScrollDown.value = false;
    floatingDateLabel.value = null;
    floatingDateVisible.value = false;
    highlightedMessageId.value = null;
    clearHighlightTimeout();
    clearDateIslandTimeout();
    cancelDateIslandFrame();
  }

  function stop(): void {
    clearHighlightTimeout();
    clearDateIslandTimeout();
    cancelDateIslandFrame();
  }

  function isAtBottom(): boolean {
    const root = scrollRoot.value;
    if (root === null) {
      return true;
    }
    return root.scrollHeight - root.scrollTop - root.clientHeight <= SCROLL_BOTTOM_EPSILON_PX;
  }

  function showFloatingDateIsland(): void {
    scheduleFloatingDateLabelUpdate();
    floatingDateVisible.value = true;
    clearDateIslandTimeout();
    dateIslandHideTimeout = setTimeout(() => {
      floatingDateVisible.value = false;
      dateIslandHideTimeout = null;
    }, DATE_ISLAND_HIDE_DELAY_MS);
  }

  function scheduleFloatingDateLabelUpdate(): void {
    if (dateIslandFrame !== null) {
      return;
    }
    dateIslandFrame = browserGlobals().requestAnimationFrame(() => {
      dateIslandFrame = null;
      floatingDateLabel.value = visibleDateLabel();
    });
  }

  function visibleDateLabel(): string | null {
    const root = scrollRoot.value;
    if (root === null) {
      return null;
    }

    const rootRect = root.getBoundingClientRect();
    const sampleX = rootRect.left + rootRect.width / 2;
    for (const offset of DATE_ISLAND_SAMPLE_OFFSETS) {
      const sampleY = Math.min(rootRect.bottom - 1, rootRect.top + offset);
      const element = browserGlobals().document.elementFromPoint(sampleX, sampleY);
      const datedElement = closestDateElement(element);
      if (datedElement === null || !root.contains(datedElement)) {
        continue;
      }
      const label = datedElement.dataset?.dateLabel;
      if (label !== undefined && label.length > 0) {
        return label;
      }
    }

    return floatingDateLabel.value;
  }

  function clearHighlightTimeout(): void {
    if (highlightTimeout === null) {
      return;
    }
    clearTimeout(highlightTimeout);
    highlightTimeout = null;
  }

  function clearDateIslandTimeout(): void {
    if (dateIslandHideTimeout === null) {
      return;
    }
    clearTimeout(dateIslandHideTimeout);
    dateIslandHideTimeout = null;
  }

  function cancelDateIslandFrame(): void {
    if (dateIslandFrame === null) {
      return;
    }
    browserGlobals().cancelAnimationFrame(dateIslandFrame);
    dateIslandFrame = null;
  }

  function closestDateElement(element: BrowserElement | null): BrowserElement | null {
    if (element === null || !('closest' in element) || typeof element.closest !== 'function') {
      return null;
    }
    return element.closest('[data-date-label]');
  }

  function browserElementFromRef(value: unknown): BrowserElement | null {
    const elementConstructor = browserGlobals().HTMLElement;
    if (value instanceof elementConstructor) {
      return value;
    }
    const element =
      value !== null && typeof value === 'object' && '$el' in value
        ? ((value as ComponentPublicInstance).$el as unknown)
        : null;
    return element instanceof elementConstructor ? element : null;
  }

  function browserGlobals(): BrowserGlobals {
    return globalThis as unknown as BrowserGlobals;
  }

  return {
    floatingDateLabel,
    floatingDateVisible,
    highlightedMessageId,
    isNearBottom,
    onScroll,
    resetScrollState,
    scrollRoot,
    scrollToBottom,
    scrollToMessage,
    setMessageElement,
    setScrollRoot,
    showScrollDown,
    stop,
    updateScrollDownVisibility
  };
}
