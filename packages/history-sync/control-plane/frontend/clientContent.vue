<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';

import { useControlPlaneHost } from '@agentg/framework/cp';
import type { SlotContext } from '@agentg/framework/cp';

import SelectedClient from './components/selectedClient.vue';
import { applyTimelineEvent } from './selectedEvents.js';
import { normalizeViewportDays, selectedClientView } from './selectedClientView.js';
import { readStorage, writeStorage } from './storage.js';
import {
  DEFAULT_VIEWPORT_DAYS,
  type ControlPlaneEvent,
  type HistorySyncBoundary,
  type HistorySyncInterval,
  type HistorySyncRange,
  type HistorySyncTarget,
  type SelectedHistorySyncChat,
  type SelectedHistorySyncState,
  type SelectedHistorySyncStatus
} from './views.js';

const props = defineProps<{
  slotContext?: SlotContext | undefined;
}>();

const SELECTED_HISTORY_SYNC_LOADING_FEEDBACK_DELAY_MS = 240;
const storagePrefix = 'agentg.history-sync.controlPlane';
const host = useControlPlaneHost();
const selectedHistorySyncState = ref<SelectedHistorySyncState | null>(null);
const selectedHistorySyncLoadingVisible = ref(false);
const selectedHistorySyncStatus = ref<SelectedHistorySyncStatus>('idle');
const defaultViewportDays = ref(readStoredViewportDays());
const viewportDays = ref<number | null>(defaultViewportDays.value);
let stopEvents: (() => void) | null = null;
let loadSequence = 0;
let loadingFeedbackTimeoutId: ReturnType<typeof setTimeout> | null = null;

const selectedChatId = computed(() => contextString(props.slotContext, 'selectedChatId'));
const view = computed(() =>
  selectedClientView({
    defaultViewportDays: defaultViewportDays.value,
    selectedChatId: selectedChatId.value,
    selectedHistorySyncLoadingVisible: selectedHistorySyncLoadingVisible.value,
    selectedHistorySyncState: selectedHistorySyncState.value,
    selectedHistorySyncStatus: selectedHistorySyncStatus.value,
    viewportDays: viewportDays.value
  })
);

watch(
  selectedChatId,
  (chatId) => {
    clearLoadingFeedbackTimeout();
    selectedHistorySyncState.value = null;
    selectedHistorySyncLoadingVisible.value = false;
    selectedHistorySyncStatus.value = chatId === null ? 'idle' : 'loading';
    viewportDays.value = defaultViewportDays.value;
    if (chatId === null) {
      loadSequence += 1;
      return;
    }
    void loadSelectedState(chatId).catch(pushLocalError);
  },
  { immediate: true }
);

onMounted(() => {
  stopEvents = host.subscribeEvents((event) => {
    if (selectedHistorySyncState.value === null || selectedHistorySyncStatus.value !== 'ready') {
      return;
    }
    if (applyTimelineEvent(selectedHistorySyncState.value, event as ControlPlaneEvent)) {
      selectedHistorySyncState.value = cloneSelectedHistorySyncState(
        selectedHistorySyncState.value
      );
    }
  });
});

onBeforeUnmount(() => {
  clearLoadingFeedbackTimeout();
  stopEvents?.();
  stopEvents = null;
});

async function loadSelectedState(chatId: string): Promise<void> {
  const sequence = ++loadSequence;
  selectedHistorySyncStatus.value = 'loading';
  scheduleLoadingFeedback(sequence);
  const result = await host.rpc('history-sync.getChatHistorySyncState', { chatId });
  if (sequence !== loadSequence || selectedChatId.value !== chatId) {
    return;
  }
  clearLoadingFeedbackTimeout();
  const selectedState = normalizeSelectedHistorySyncState(result);
  selectedHistorySyncState.value = selectedState;
  selectedHistorySyncLoadingVisible.value = false;
  selectedHistorySyncStatus.value = selectedState.chat ? 'ready' : 'unavailable';
}

function addPresetTarget(preset: string): void {
  const chatId = selectedChatId.value;
  if (chatId === null) {
    return;
  }
  void host.rpc('history-sync.upsertTarget', { chatId, preset }).catch(pushLocalError);
}

function addCustomTarget(start: string, end: string): void {
  const chatId = selectedChatId.value;
  if (chatId === null) {
    return;
  }
  void host.rpc('history-sync.upsertTarget', { chatId, end, start }).catch(pushLocalError);
}

function deleteTarget(targetId: string): void {
  if (targetId.trim().length === 0) {
    return;
  }
  void host.rpc('history-sync.deleteTarget', { targetId }).catch(pushLocalError);
}

function clearTimelineScale(): void {
  viewportDays.value = null;
}

function selectTimelineScale(value: number): void {
  if (viewportDays.value === value) {
    defaultViewportDays.value = normalizeViewportDays(value);
    writeStorage(`${storagePrefix}.defaultViewportDays`, String(defaultViewportDays.value));
  }
  viewportDays.value = normalizeViewportDays(value);
}

function readStoredViewportDays(): number {
  return normalizeViewportDays(
    readStorage(`${storagePrefix}.defaultViewportDays`) ?? DEFAULT_VIEWPORT_DAYS
  );
}

function contextString(context: SlotContext | undefined, key: string): string | null {
  const value = context?.[key];
  return typeof value === 'string' && value.trim().length > 0 ? value : null;
}

function pushLocalError(error: unknown): void {
  console.error(error);
}

function scheduleLoadingFeedback(sequence: number): void {
  selectedHistorySyncLoadingVisible.value = false;
  loadingFeedbackTimeoutId = setTimeout(() => {
    loadingFeedbackTimeoutId = null;
    if (sequence !== loadSequence) {
      return;
    }
    selectedHistorySyncLoadingVisible.value = true;
  }, SELECTED_HISTORY_SYNC_LOADING_FEEDBACK_DELAY_MS);
}

function clearLoadingFeedbackTimeout(): void {
  if (loadingFeedbackTimeoutId === null) {
    return;
  }
  clearTimeout(loadingFeedbackTimeoutId);
  loadingFeedbackTimeoutId = null;
}

function normalizeSelectedHistorySyncState(value: unknown): SelectedHistorySyncState {
  const input = asRecord(value);
  const chat = normalizeSelectedHistorySyncChat(input?.chat);
  return {
    chat,
    coverage: asArray(input?.coverage).map(normalizeHistorySyncInterval),
    desired: asArray(input?.desired).map(normalizeHistorySyncInterval),
    missing: asArray(input?.missing).map(normalizeHistorySyncInterval),
    targets: asArray(input?.targets).map(normalizeHistorySyncTarget)
  };
}

function normalizeSelectedHistorySyncChat(value: unknown): SelectedHistorySyncChat | null {
  const input = asRecord(value);
  if (input === undefined) {
    return null;
  }
  return {
    historySyncBeginningReached: input.historySyncBeginningReached === true,
    historySyncStartAt: asString(input.historySyncStartAt) ?? null,
    id: asString(input.id) ?? '',
    isBot: input.isBot === true,
    messageCount: asNonNegativeInteger(input.messageCount),
    title: asString(input.title) ?? '',
    type: asString(input.type) ?? '',
    updatedAt: asString(input.updatedAt) ?? ''
  };
}

function normalizeHistorySyncInterval(value: unknown): HistorySyncInterval {
  const input = asRecord(value);
  return removeUndefinedProperties({
    coveredAt: asString(input?.coveredAt),
    endAt: asString(input?.endAt) ?? '',
    messageCount:
      input?.messageCount === undefined ? undefined : asNonNegativeInteger(input.messageCount),
    startAt: asString(input?.startAt) ?? ''
  }) as HistorySyncInterval;
}

function normalizeHistorySyncTarget(value: unknown): HistorySyncTarget {
  const input = asRecord(value);
  const projected = asRecord(input?.projected);
  return removeUndefinedProperties({
    chatId: asString(input?.chatId) ?? '',
    id: asString(input?.id) ?? '',
    projected: projected === undefined ? undefined : normalizeHistorySyncInterval(projected),
    range: normalizeHistorySyncRange(input?.range),
    templateId: input?.templateId === null ? null : asString(input?.templateId)
  }) as HistorySyncTarget;
}

function normalizeHistorySyncRange(value: unknown): HistorySyncRange {
  const input = asRecord(value);
  return {
    end: normalizeHistorySyncBoundary(input?.end),
    start: normalizeHistorySyncBoundary(input?.start)
  };
}

function normalizeHistorySyncBoundary(value: unknown): HistorySyncBoundary {
  const input = asRecord(value);
  if (input?.kind === 'absolute') {
    return {
      at: asString(input.at) ?? '',
      kind: 'absolute'
    };
  }
  return {
    expression: asString(input?.expression) ?? '',
    kind: 'expression'
  };
}

function cloneSelectedHistorySyncState(value: SelectedHistorySyncState): SelectedHistorySyncState {
  return {
    chat: value.chat === null ? null : { ...value.chat },
    coverage: value.coverage.map((interval) => ({ ...interval })),
    desired: value.desired.map((interval) => ({ ...interval })),
    missing: value.missing.map((interval) => ({ ...interval })),
    targets: value.targets.map((target) => ({ ...target }))
  };
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function asNonNegativeInteger(value: unknown): number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : 0;
}

function removeUndefinedProperties(value: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined));
}
</script>

<template>
  <SelectedClient
    :view="view"
    @custom-target="addCustomTarget"
    @delete-target="deleteTarget"
    @freeform-scale="clearTimelineScale"
    @preset-target="addPresetTarget"
    @scale-select="selectTimelineScale"
  />
</template>
