import {
  computed,
  onBeforeUnmount,
  onMounted,
  ref,
  shallowRef,
  watch,
  type ComputedRef
} from 'vue';

import { useDashboardHost, type DashboardHostEvent } from '@agentg/framework/dashboard';
import type { GetMessagesInput } from '../../src/procedures/get-messages/contract.js';
import { useTelegramDashboardApi } from './api.js';
import {
  DEFAULT_VIEWPORT_DAYS,
  normalizeViewportDays,
  readHistoryCoverageState,
  timelineScaleButtons,
  type HistoryCoverageState,
  type HistoryCoverageStatus
} from './historyCoverageState.js';
import { readStorage, writeStorage } from './storage.js';

type PendingRangeRequest = {
  chatId: string;
  input: GetMessagesInput;
  requestId: string;
};

const storagePrefix = 'agentg.telegram.history-coverage';

export function useHistoryCoverage(options: { selectedChatId: ComputedRef<string | null> }) {
  const api = useTelegramDashboardApi();
  const host = useDashboardHost();
  const defaultViewportDays = ref(readStoredViewportDays());
  const lastError = ref<string | null>(null);
  const loadingVisible = ref(false);
  const pendingRange = ref<PendingRangeRequest | null>(null);
  const requestStatus = ref<string | null>(null);
  const selectedState = shallowRef<HistoryCoverageState | null>(null);
  const status = ref<HistoryCoverageStatus>('idle');
  const viewportDays = ref<number | null>(defaultViewportDays.value);

  let loadSequence = 0;
  let loadingFeedbackTimeoutId: ReturnType<typeof setTimeout> | null = null;
  let stopEvents: (() => void) | null = null;
  let stopChatWatch: (() => void) | null = null;

  const scaleButtons = computed(() =>
    timelineScaleButtons({
      defaultViewportDays: defaultViewportDays.value,
      viewportDays: viewportDays.value
    })
  );

  onMounted(() => {
    stopEvents = host.subscribeEvents(applyEvent);
    stopChatWatch = watch(
      options.selectedChatId,
      (chatId) => {
        clearLoadingFeedbackTimeout();
        lastError.value = null;
        pendingRange.value = null;
        requestStatus.value = null;
        selectedState.value = null;
        loadingVisible.value = false;
        viewportDays.value = defaultViewportDays.value;
        status.value = chatId === null ? 'idle' : 'loading';
        if (chatId === null) {
          loadSequence += 1;
          return;
        }
        void loadSelectedState(chatId);
      },
      { immediate: true }
    );
  });

  onBeforeUnmount(() => {
    clearLoadingFeedbackTimeout();
    stopChatWatch?.();
    stopChatWatch = null;
    stopEvents?.();
    stopEvents = null;
  });

  async function refresh(): Promise<void> {
    const chatId = options.selectedChatId.value;
    if (chatId === null) {
      return;
    }
    await loadSelectedState(chatId);
  }

  async function requestRange(startAt: string, endAt: string): Promise<void> {
    const chatId = options.selectedChatId.value;
    if (chatId === null || startAt >= endAt) {
      return;
    }
    const input: GetMessagesInput = {
      owner: {
        chatId,
        kind: 'chat'
      },
      selector: {
        endAt,
        kind: 'range',
        startAt
      }
    };
    lastError.value = null;
    requestStatus.value = null;
    pendingRange.value = null;
    await requestMessages(input, chatId);
  }

  function clearTimelineScale(): void {
    viewportDays.value = null;
  }

  function selectTimelineScale(value: number): void {
    const nextValue = normalizeViewportDays(value);
    if (viewportDays.value === nextValue) {
      defaultViewportDays.value = nextValue;
      writeStorage(`${storagePrefix}.defaultViewportDays`, String(defaultViewportDays.value));
    }
    viewportDays.value = nextValue;
  }

  async function loadSelectedState(chatId: string): Promise<void> {
    const sequence = ++loadSequence;
    lastError.value = null;
    status.value = 'loading';
    scheduleLoadingFeedback(sequence);
    let result: unknown;
    try {
      result = await api.historyCoverage({ chatId });
    } catch (error) {
      if (sequence !== loadSequence || options.selectedChatId.value !== chatId) {
        return;
      }
      clearLoadingFeedbackTimeout();
      lastError.value = errorMessage(error);
      loadingVisible.value = false;
      status.value = 'failed';
      return;
    }
    if (sequence !== loadSequence || options.selectedChatId.value !== chatId) {
      return;
    }
    clearLoadingFeedbackTimeout();
    const nextState = readHistoryCoverageState(result, chatId);
    if (nextState === null) {
      lastError.value = 'History coverage response belongs to a different chat.';
      loadingVisible.value = false;
      selectedState.value = null;
      status.value = 'failed';
      return;
    }
    lastError.value = null;
    loadingVisible.value = false;
    selectedState.value = nextState;
    status.value = nextState.chat === null ? 'unavailable' : 'ready';
  }

  async function requestMessages(input: GetMessagesInput, chatId: string): Promise<void> {
    try {
      const result = await api.getMessages(input);
      if (options.selectedChatId.value !== chatId) {
        return;
      }
      const requestId = pendingRequestId(result);
      if (requestId !== null) {
        pendingRange.value = {
          chatId,
          input,
          requestId
        };
        requestStatus.value = 'Request pending';
        return;
      }
      pendingRange.value = null;
      requestStatus.value = 'Range ready';
      await refresh();
    } catch (error) {
      if (options.selectedChatId.value === chatId) {
        lastError.value = errorMessage(error);
      }
    }
  }

  function applyEvent(event: DashboardHostEvent): void {
    const requestId = eventRequestId(event);
    const pending = pendingRange.value;
    if (requestId === null || pending?.requestId !== requestId) {
      return;
    }
    if (options.selectedChatId.value !== pending.chatId) {
      return;
    }
    if (event.type === 'telegram.messages.ready') {
      pendingRange.value = null;
      requestStatus.value = 'Range ready';
      void requestMessages(pending.input, pending.chatId);
      return;
    }
    if (event.type === 'telegram.messages.failed') {
      pendingRange.value = null;
      requestStatus.value = null;
      lastError.value = messagesFailedEventMessage(event);
    }
  }

  function scheduleLoadingFeedback(sequence: number): void {
    loadingVisible.value = false;
    loadingFeedbackTimeoutId = setTimeout(() => {
      loadingFeedbackTimeoutId = null;
      if (sequence !== loadSequence) {
        return;
      }
      loadingVisible.value = true;
    }, 240);
  }

  function clearLoadingFeedbackTimeout(): void {
    if (loadingFeedbackTimeoutId === null) {
      return;
    }
    clearTimeout(loadingFeedbackTimeoutId);
    loadingFeedbackTimeoutId = null;
  }

  return {
    clearTimelineScale,
    lastError,
    loadingVisible,
    pendingRange,
    refresh,
    requestRange,
    requestStatus,
    scaleButtons,
    selectTimelineScale,
    selectedState,
    status,
    viewportDays
  };
}

function readStoredViewportDays(): number {
  return normalizeViewportDays(
    readStorage(`${storagePrefix}.defaultViewportDays`) ?? DEFAULT_VIEWPORT_DAYS
  );
}

function pendingRequestId(result: { requestId?: unknown; status?: unknown }): string | null {
  return result.status === 'pending' && typeof result.requestId === 'string'
    ? result.requestId
    : null;
}

function eventRequestId(event: DashboardHostEvent): string | null {
  const requestId = asRecord(event.data)?.requestId;
  return typeof requestId === 'string' && requestId.length > 0 ? requestId : null;
}

function messagesFailedEventMessage(event: DashboardHostEvent): string {
  const reason = asRecord(event.data)?.reason;
  return typeof reason === 'string' && reason.trim().length > 0
    ? `Message history request failed: ${reason}`
    : 'Message history request failed.';
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
