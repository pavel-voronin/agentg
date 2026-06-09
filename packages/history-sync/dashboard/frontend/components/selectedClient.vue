<script setup lang="ts">
import { ref } from 'vue';

import { UiButton } from '@agentg/framework/dashboard';
import type { SelectedClientView, TimelineScaleButtonView } from '../views.js';
import TimelinePanel from './timelinePanel.vue';

defineProps<{
  view: SelectedClientView;
}>();

const emit = defineEmits<{
  customTarget: [start: string, end: string];
  deleteTarget: [targetId: string];
  freeformScale: [];
  presetTarget: [preset: string];
  scaleSelect: [value: number];
}>();

const customStart = ref('');
const customEnd = ref('');

function addCustomTarget(): void {
  emit('customTarget', customStart.value.trim(), customEnd.value.trim());
}

function scaleButtonVariant(scale: TimelineScaleButtonView): 'neutral' | 'selected' {
  return scale.active ? 'selected' : 'neutral';
}
</script>

<template>
  <section id="clientShell" class="selected-client">
    <div v-if="view.status === 'empty'" class="selected-client__empty-scroll">
      <div class="selected-client__empty-padding">
        <div class="selected-client__empty-card">
          <div class="selected-client__empty-title">No chat selected</div>
          <div class="selected-client__empty-copy">
            No chat is selected. Use the chat list to inspect one chat, or keep this global client
            open while watching metrics and history events.
          </div>
        </div>
      </div>
    </div>

    <div
      v-else-if="view.status === 'pending'"
      aria-hidden="true"
      class="selected-client__state-message"
    ></div>

    <div v-else-if="view.status === 'loading'" class="selected-client__state-message">
      Loading selected chat.
    </div>

    <div v-else-if="view.status === 'unavailable'" class="selected-client__state-message">
      Selected chat is not available.
    </div>

    <div v-else class="selected-client__content">
      <div class="selected-client__body">
        <section class="selected-client__section">
          <div class="selected-client__section-header">
            <div>
              <div class="selected-client__section-title">Targets</div>
              <div class="selected-client__section-copy">Target history coverage for this chat</div>
            </div>
            <div class="selected-client__preset-actions">
              <UiButton @click="emit('presetTarget', 'last7d')"> Last 7d </UiButton>
              <UiButton @click="emit('presetTarget', 'last30d')"> Last 30d </UiButton>
              <UiButton @click="emit('presetTarget', 'full')"> Past..now </UiButton>
            </div>
          </div>
          <div class="selected-client__custom-target">
            <input
              v-model="customStart"
              class="selected-client__target-input"
              placeholder="Start: past, now-1y2mo, now-1h3s, 2026-01-01"
            />
            <input
              v-model="customEnd"
              class="selected-client__target-input"
              placeholder="End: now, 2026-02-01"
            />
            <UiButton
              class="selected-client__custom-target-button"
              variant="primary"
              @click="addCustomTarget"
            >
              Add
            </UiButton>
          </div>
        </section>

        <section class="selected-client__history-sync-section">
          <div class="selected-client__section-header">
            <div class="selected-client__section-title">History Sync</div>
            <div class="selected-client__scale-controls">
              <span class="selected-client__scale-label">Scale</span>
              <div class="selected-client__scale-actions">
                <UiButton
                  v-for="scale in view.scaleButtons"
                  :key="scale.value"
                  :aria-pressed="scale.active"
                  :data-default-scale="scale.isDefault"
                  class="selected-client__scale-button"
                  size="sm"
                  :variant="scaleButtonVariant(scale)"
                  @click="emit('scaleSelect', scale.value)"
                >
                  {{ scale.label }}
                </UiButton>
              </div>
            </div>
          </div>
          <TimelinePanel
            :data="view.historySyncState"
            :viewport-days="view.viewportDays"
            @add-target="(start, end) => emit('customTarget', start, end)"
            @delete-target="(targetId) => emit('deleteTarget', targetId)"
            @freeform-scale="emit('freeformScale')"
          />
        </section>
      </div>
    </div>
  </section>
</template>

<style scoped>
@reference "tailwindcss";
.selected-client {
  @apply flex h-full min-h-0 w-full flex-col overflow-hidden bg-white;
}

.selected-client__empty-scroll {
  @apply min-h-0 flex-1 overflow-auto;
}

.selected-client__empty-padding {
  @apply p-8 text-center;
}

.selected-client__empty-card {
  @apply mx-auto max-w-xl text-center;
}

.selected-client__empty-title {
  @apply text-base font-semibold;
}

.selected-client__empty-copy {
  @apply mt-2 text-sm text-zinc-500;
}

.selected-client__state-message {
  @apply min-h-0 flex-1 overflow-auto p-8 text-center text-sm text-zinc-500;
}

.selected-client__content {
  @apply min-h-0 flex-1 overflow-auto;
}

.selected-client__body {
  @apply grid gap-4 p-4;
}

.selected-client__section {
  @apply grid gap-3;
}

.selected-client__section-header {
  @apply flex flex-wrap items-center justify-between gap-2;
}

.selected-client__section-title {
  @apply text-sm font-semibold;
}

.selected-client__section-copy {
  @apply text-xs text-zinc-500;
}

.selected-client__preset-actions {
  @apply flex flex-wrap gap-2;
}

.selected-client__custom-target {
  @apply grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] gap-2;
}

.selected-client__target-input {
  @apply rounded-lg border border-zinc-300 bg-white px-3 py-2 outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100;
}

.selected-client__custom-target-button {
  @apply h-auto py-2;
}

.selected-client__history-sync-section {
  @apply grid gap-3 border-t border-zinc-200 pt-4;
}

.selected-client__scale-controls {
  @apply flex flex-wrap items-center gap-2;
}

.selected-client__scale-label {
  @apply text-xs text-zinc-500;
}

.selected-client__scale-actions {
  @apply flex flex-wrap gap-1.5;
}

.selected-client__scale-button {
  @apply relative;
}

.selected-client__scale-button[data-default-scale='true'] {
  @apply after:absolute after:-bottom-1.5 after:left-0 after:right-0 after:h-px after:bg-sky-400 after:content-[''];
}
</style>
