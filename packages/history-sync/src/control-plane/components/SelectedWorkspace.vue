<script setup lang="ts">
import { ref } from 'vue';

import UiButton from '@agentg/control-plane-extension/ui';
import type {
  SelectedWorkspaceView,
  TimelineScaleButtonView
} from '@agentg/shared/control-plane/views';
import HistoryTimeline from './HistoryTimeline.vue';

defineProps<{
  view: SelectedWorkspaceView;
}>();

const emit = defineEmits<{
  close: [];
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
  <section
    id="workspaceShell"
    :class="[
      'flex min-h-0 flex-col overflow-hidden',
      view.status === 'empty' ? '' : 'rounded-lg border border-zinc-200 bg-white'
    ]"
  >
    <div v-if="view.status === 'empty'" class="min-h-0 flex-1 overflow-auto">
      <div class="p-8 text-center">
        <div class="mx-auto max-w-xl text-center">
          <div class="text-base font-semibold">No chat selected</div>
          <div class="mt-2 text-sm text-zinc-500">
            No chat is selected. Use the chat list to inspect one chat, or keep this global
            workspace open while watching metrics and history events.
          </div>
        </div>
      </div>
    </div>

    <div
      v-else-if="view.status === 'loading'"
      class="min-h-0 flex-1 overflow-auto p-8 text-center text-sm text-zinc-500"
    >
      Loading selected chat.
    </div>

    <div
      v-else-if="view.status === 'unavailable'"
      class="min-h-0 flex-1 overflow-auto p-8 text-center text-sm text-zinc-500"
    >
      Selected chat is not available.
    </div>

    <div v-else class="min-h-0 flex-1 overflow-auto">
      <div class="border-b border-zinc-200 p-4">
        <div class="flex flex-wrap items-stretch justify-between gap-3">
          <div class="min-w-0">
            <div class="truncate text-base font-semibold">{{ view.chat.title }}</div>
            <div class="mt-1 flex flex-wrap gap-2 text-xs text-zinc-500">
              <code class="rounded bg-zinc-100 px-1.5 py-0.5">{{ view.chat.id }}</code>
              <span>{{ view.chat.type }}</span>
              <span>{{ view.chat.messageCount }}</span>
              <span v-if="view.chat.historyLabel">{{ view.chat.historyLabel }}</span>
            </div>
          </div>
          <div class="flex shrink-0 items-center gap-2">
            <UiButton
              aria-label="Close chat"
              title="Close chat"
              class="text-lg leading-none text-zinc-600"
              size="icon-md"
              @click="emit('close')"
            >
              ×
            </UiButton>
          </div>
        </div>
      </div>

      <div class="grid gap-4 p-4">
        <section class="grid gap-3">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <div>
              <div class="text-sm font-semibold">Targets</div>
              <div class="text-xs text-zinc-500">Target history coverage for this chat</div>
            </div>
            <div class="flex flex-wrap gap-2">
              <UiButton @click="emit('presetTarget', 'last7d')"> Last 7d </UiButton>
              <UiButton @click="emit('presetTarget', 'last30d')"> Last 30d </UiButton>
              <UiButton @click="emit('presetTarget', 'full')"> Past..now </UiButton>
            </div>
          </div>
          <div class="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] gap-2">
            <input
              v-model="customStart"
              class="rounded-lg border border-zinc-300 bg-white px-3 py-2 outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
              placeholder="Start: past, now-1y2mo, now-1h3s, 2026-01-01"
            />
            <input
              v-model="customEnd"
              class="rounded-lg border border-zinc-300 bg-white px-3 py-2 outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
              placeholder="End: now, 2026-02-01"
            />
            <UiButton class="h-auto py-2" variant="primary" @click="addCustomTarget">
              Add
            </UiButton>
          </div>
        </section>

        <section class="grid gap-3 border-t border-zinc-200 pt-4">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <div class="text-sm font-semibold">History</div>
            <div class="flex flex-wrap items-center gap-2">
              <span class="text-xs text-zinc-500">Scale</span>
              <div class="flex flex-wrap gap-1.5">
                <UiButton
                  v-for="scale in view.scaleButtons"
                  :key="scale.value"
                  :aria-pressed="scale.active"
                  :data-default-scale="scale.isDefault"
                  class="relative"
                  size="sm"
                  :variant="scaleButtonVariant(scale)"
                  @click="emit('scaleSelect', scale.value)"
                >
                  {{ scale.label }}
                </UiButton>
              </div>
            </div>
          </div>
          <HistoryTimeline
            :data="view.historyState"
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
