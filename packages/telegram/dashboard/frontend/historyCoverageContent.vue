<script setup lang="ts">
import { computed } from 'vue';

import { UiButton, type SlotContext } from '@agentg/framework/dashboard';
import TimelinePanel from './components/timelinePanel.vue';
import { useHistoryCoverage } from './useHistoryCoverage.js';
import type { TimelineScaleButtonView } from './historyCoverageState.js';

const props = defineProps<{
  slotContext?: SlotContext | undefined;
}>();

const selectedChatId = computed(() => {
  const value = props.slotContext?.selectedChatId;
  return typeof value === 'string' && value.trim().length > 0 ? value : null;
});
const coverage = useHistoryCoverage({
  selectedChatId
});
const statusLabel = computed(() => {
  if (coverage.pendingRange.value !== null) {
    return 'Waiting for range';
  }
  return coverage.requestStatus.value;
});

function scaleButtonVariant(scale: TimelineScaleButtonView): 'neutral' | 'selected' {
  return scale.active ? 'selected' : 'neutral';
}
</script>

<template>
  <section id="historyCoverageShell" class="history-coverage-content">
    <div v-if="selectedChatId === null" class="history-coverage-content__empty-scroll">
      <div class="history-coverage-content__empty-padding">
        <div class="history-coverage-content__empty-card">
          <div class="history-coverage-content__empty-title">No chat selected</div>
          <div class="history-coverage-content__empty-copy">
            No chat is selected. Use the chat list to inspect history coverage for one chat.
          </div>
        </div>
      </div>
    </div>

    <div
      v-else-if="coverage.status.value === 'idle' || coverage.status.value === 'loading'"
      class="history-coverage-content__state-message"
    >
      <span v-if="coverage.loadingVisible.value">Loading selected chat.</span>
    </div>

    <div
      v-else-if="coverage.status.value === 'unavailable'"
      class="history-coverage-content__state-message"
    >
      Selected chat is not available.
    </div>

    <div
      v-else-if="coverage.status.value === 'failed'"
      class="history-coverage-content__state-message"
    >
      {{ coverage.lastError.value ?? 'History coverage is unavailable.' }}
    </div>

    <div v-else-if="coverage.selectedState.value !== null" class="history-coverage-content__body">
      <div v-if="coverage.lastError.value !== null" class="history-coverage-content__error-message">
        {{ coverage.lastError.value }}
      </div>

      <section class="history-coverage-content__section">
        <div class="history-coverage-content__section-header">
          <div class="history-coverage-content__section-title">History Coverage</div>
          <div class="history-coverage-content__scale-controls">
            <span class="history-coverage-content__scale-label">Scale</span>
            <div class="history-coverage-content__scale-actions">
              <UiButton
                v-for="scale in coverage.scaleButtons.value"
                :key="scale.value"
                :aria-pressed="scale.active"
                :data-default-scale="scale.isDefault"
                class="history-coverage-content__scale-button"
                size="sm"
                :variant="scaleButtonVariant(scale)"
                @click="coverage.selectTimelineScale(scale.value)"
              >
                {{ scale.label }}
              </UiButton>
            </div>
          </div>
        </div>

        <TimelinePanel
          :data="coverage.selectedState.value"
          :viewport-days="coverage.viewportDays.value"
          @freeform-scale="coverage.clearTimelineScale"
          @range-select="(start, end) => void coverage.requestRange(start, end)"
        />

        <div v-if="statusLabel !== null" class="history-coverage-content__status">
          {{ statusLabel }}
        </div>
      </section>
    </div>
  </section>
</template>

<style scoped>
@reference "tailwindcss";

.history-coverage-content {
  @apply flex h-full min-h-0 w-full flex-col overflow-hidden bg-white;
}

.history-coverage-content__empty-scroll {
  @apply min-h-0 flex-1 overflow-auto;
}

.history-coverage-content__empty-padding {
  @apply p-8 text-center;
}

.history-coverage-content__empty-card {
  @apply mx-auto max-w-xl text-center;
}

.history-coverage-content__empty-title {
  @apply text-base font-semibold;
}

.history-coverage-content__empty-copy {
  @apply mt-2 text-sm text-zinc-500;
}

.history-coverage-content__state-message {
  @apply min-h-0 flex-1 overflow-auto p-8 text-center text-sm text-zinc-500;
}

.history-coverage-content__body {
  @apply grid gap-4 p-4;
}

.history-coverage-content__error-message {
  @apply rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700;
}

.history-coverage-content__section {
  @apply grid gap-3;
}

.history-coverage-content__section-header {
  @apply flex flex-wrap items-center justify-between gap-2;
}

.history-coverage-content__section-title {
  @apply text-sm font-semibold;
}

.history-coverage-content__scale-controls {
  @apply flex flex-wrap items-center gap-2;
}

.history-coverage-content__scale-label {
  @apply text-xs text-zinc-500;
}

.history-coverage-content__scale-actions {
  @apply flex flex-wrap gap-1.5;
}

.history-coverage-content__scale-button {
  @apply relative;
}

.history-coverage-content__scale-button[data-default-scale='true'] {
  @apply after:absolute after:-bottom-1.5 after:left-0 after:right-0 after:h-px after:bg-sky-400 after:content-[''];
}

.history-coverage-content__status {
  @apply text-xs text-zinc-500;
}
</style>
