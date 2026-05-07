<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';

import { useControlPlaneHost } from '@agentg/control-plane-sdk/host';
import type { SlotContext } from '@agentg/control-plane-sdk/slots';

import SelectedWorkspace from './components/SelectedWorkspace.vue';
import { applyHistoryTimelineEvent } from './selectedHistoryEvents.js';
import { normalizeViewportDays, selectedWorkspaceView } from './selectedWorkspaceView.js';
import { readStorage, writeStorage } from './storage.js';
import {
  DEFAULT_VIEWPORT_DAYS,
  type ControlPlaneEvent,
  type HistoryBoundary,
  type HistoryInterval,
  type HistoryJob,
  type HistoryRange,
  type HistoryTarget,
  type SelectedHistoryChat,
  type SelectedHistoryState,
  type SelectedHistoryStatus
} from './views.js';

const props = defineProps<{
  slotContext?: SlotContext | undefined;
}>();

const historyStoragePrefix = 'agentg.history.controlPlane';
const host = useControlPlaneHost();
const selectedHistoryState = ref<SelectedHistoryState | null>(null);
const selectedHistoryStatus = ref<SelectedHistoryStatus>('idle');
const defaultViewportDays = ref(readStoredViewportDays());
const viewportDays = ref<number | null>(defaultViewportDays.value);
let stopEvents: (() => void) | null = null;
let loadSequence = 0;

const selectedChatId = computed(() => contextString(props.slotContext, 'selectedChatId'));
const closeSelectedChat = computed(() => contextFunction(props.slotContext, 'closeSelectedChat'));
const view = computed(() =>
  selectedWorkspaceView({
    defaultViewportDays: defaultViewportDays.value,
    selectedChatId: selectedChatId.value,
    selectedHistoryState: selectedHistoryState.value,
    selectedHistoryStatus: selectedHistoryStatus.value,
    viewportDays: viewportDays.value
  })
);

watch(
  selectedChatId,
  (chatId) => {
    selectedHistoryState.value = null;
    selectedHistoryStatus.value = chatId === null ? 'idle' : 'loading';
    viewportDays.value = defaultViewportDays.value;
    if (chatId !== null) {
      void loadSelectedState(chatId).catch(pushLocalError);
    }
  },
  { immediate: true }
);

onMounted(() => {
  stopEvents = host.subscribeEvents((event) => {
    if (selectedHistoryState.value === null || selectedHistoryStatus.value !== 'ready') {
      return;
    }
    applyHistoryTimelineEvent(selectedHistoryState.value, event as ControlPlaneEvent);
  });
});

onBeforeUnmount(() => {
  stopEvents?.();
  stopEvents = null;
});

async function loadSelectedState(chatId: string): Promise<void> {
  const sequence = ++loadSequence;
  selectedHistoryStatus.value = 'loading';
  const result = await host.rpc('history.getChatHistoryState', { chatId });
  if (sequence !== loadSequence || selectedChatId.value !== chatId) {
    return;
  }
  const selectedState = normalizeSelectedHistoryState(result);
  selectedHistoryState.value = selectedState;
  selectedHistoryStatus.value = selectedState.chat ? 'ready' : 'unavailable';
}

function closeChat(): void {
  closeSelectedChat.value?.();
}

function addPresetTarget(preset: string): void {
  const chatId = selectedChatId.value;
  if (chatId === null) {
    return;
  }
  void host.rpc('history.upsertTarget', { chatId, preset }).catch(pushLocalError);
}

function addCustomTarget(start: string, end: string): void {
  const chatId = selectedChatId.value;
  if (chatId === null) {
    return;
  }
  void host.rpc('history.upsertTarget', { chatId, end, start }).catch(pushLocalError);
}

function deleteTarget(targetId: string): void {
  if (targetId.trim().length === 0) {
    return;
  }
  void host.rpc('history.deleteTarget', { targetId }).catch(pushLocalError);
}

function clearTimelineScale(): void {
  viewportDays.value = null;
}

function selectTimelineScale(value: number): void {
  if (viewportDays.value === value) {
    defaultViewportDays.value = normalizeViewportDays(value);
    writeStorage(`${historyStoragePrefix}.defaultViewportDays`, String(defaultViewportDays.value));
  }
  viewportDays.value = normalizeViewportDays(value);
}

function readStoredViewportDays(): number {
  return normalizeViewportDays(
    readStorage(`${historyStoragePrefix}.defaultViewportDays`) ?? DEFAULT_VIEWPORT_DAYS
  );
}

function contextString(context: SlotContext | undefined, key: string): string | null {
  const value = context?.[key];
  return typeof value === 'string' && value.trim().length > 0 ? value : null;
}

function contextFunction(context: SlotContext | undefined, key: string): (() => void) | null {
  const value = context?.[key];
  return typeof value === 'function' ? (value as () => void) : null;
}

function pushLocalError(error: unknown): void {
  console.error(error);
}

function normalizeSelectedHistoryState(value: unknown): SelectedHistoryState {
  const input = asRecord(value);
  const chat = normalizeSelectedHistoryChat(input?.chat);
  return {
    chat,
    coverage: asArray(input?.coverage).map(normalizeHistoryInterval),
    desired: asArray(input?.desired).map(normalizeHistoryInterval),
    jobs: asArray(input?.jobs).map(normalizeHistoryJob),
    missing: asArray(input?.missing).map(normalizeHistoryInterval),
    targets: asArray(input?.targets).map(normalizeHistoryTarget)
  };
}

function normalizeSelectedHistoryChat(value: unknown): SelectedHistoryChat | null {
  const input = asRecord(value);
  if (input === undefined) {
    return null;
  }
  return {
    historyBeginningReached: input.historyBeginningReached === true,
    historyStartAt: asString(input.historyStartAt) ?? null,
    id: asString(input.id) ?? '',
    isBot: input.isBot === true,
    messageCount: asNonNegativeInteger(input.messageCount),
    title: asString(input.title) ?? '',
    type: asString(input.type) ?? '',
    updatedAt: asString(input.updatedAt) ?? ''
  };
}

function normalizeHistoryInterval(value: unknown): HistoryInterval {
  const input = asRecord(value);
  return removeUndefinedProperties({
    endAt: asString(input?.endAt) ?? '',
    messageCount:
      input?.messageCount === undefined ? undefined : asNonNegativeInteger(input.messageCount),
    startAt: asString(input?.startAt) ?? ''
  }) as HistoryInterval;
}

function normalizeHistoryJob(value: unknown): HistoryJob {
  const input = asRecord(value);
  const cursor = asRecord(input?.cursor);
  return removeUndefinedProperties({
    ...(cursor === undefined ? {} : { cursor }),
    endAt: asString(input?.endAt) ?? '',
    id: asString(input?.id) ?? '',
    startAt: asString(input?.startAt) ?? '',
    status: asString(input?.status) ?? '',
    telegramChatId: asString(input?.telegramChatId),
    updatedAt: asString(input?.updatedAt) ?? ''
  }) as HistoryJob;
}

function normalizeHistoryTarget(value: unknown): HistoryTarget {
  const input = asRecord(value);
  const projected = asRecord(input?.projected);
  return removeUndefinedProperties({
    chatId: asString(input?.chatId) ?? '',
    id: asString(input?.id) ?? '',
    projected: projected === undefined ? undefined : normalizeHistoryInterval(projected),
    range: normalizeHistoryRange(input?.range),
    templateId: input?.templateId === null ? null : asString(input?.templateId)
  }) as HistoryTarget;
}

function normalizeHistoryRange(value: unknown): HistoryRange {
  const input = asRecord(value);
  return {
    end: normalizeHistoryBoundary(input?.end),
    start: normalizeHistoryBoundary(input?.start)
  };
}

function normalizeHistoryBoundary(value: unknown): HistoryBoundary {
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
  <SelectedWorkspace
    :view="view"
    @close="closeChat"
    @custom-target="addCustomTarget"
    @delete-target="deleteTarget"
    @freeform-scale="clearTimelineScale"
    @preset-target="addPresetTarget"
    @scale-select="selectTimelineScale"
  />
</template>
