<script setup lang="ts">
import { ref } from 'vue';

import type {
  SelectedWorkspaceView,
  TimelineScaleButtonView
} from '../stores/controlPlaneStore.js';
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

function scaleButtonClass(scale: TimelineScaleButtonView): string {
  const borderClass = scale.active ? 'border-zinc-800' : 'border-zinc-300';
  return scale.active
    ? `relative h-7 rounded-lg border bg-zinc-800 px-2.5 text-xs font-medium text-white shadow-sm ${borderClass}`
    : `relative h-7 rounded-lg border bg-white px-2.5 text-xs font-medium text-zinc-700 shadow-sm hover:bg-zinc-50 ${borderClass}`;
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
            <button
              type="button"
              aria-label="Close chat"
              title="Close chat"
              class="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-300 bg-white text-lg leading-none text-zinc-600 hover:bg-zinc-50"
              @click="emit('close')"
            >
              ×
            </button>
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
              <button
                type="button"
                class="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium hover:bg-zinc-50"
                @click="emit('presetTarget', 'last7d')"
              >
                Last 7d
              </button>
              <button
                type="button"
                class="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium hover:bg-zinc-50"
                @click="emit('presetTarget', 'last30d')"
              >
                Last 30d
              </button>
              <button
                type="button"
                class="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium hover:bg-zinc-50"
                @click="emit('presetTarget', 'full')"
              >
                Past..now
              </button>
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
            <button
              type="button"
              class="rounded-lg border border-zinc-800 bg-zinc-800 px-3 py-2 font-medium text-white hover:bg-zinc-950"
              @click="addCustomTarget"
            >
              Add
            </button>
          </div>
        </section>

        <section class="grid gap-3 border-t border-zinc-200 pt-4">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <div class="text-sm font-semibold">History</div>
            <div class="flex flex-wrap items-center gap-2">
              <span class="text-xs text-zinc-500">Scale</span>
              <div class="flex flex-wrap gap-1.5">
                <button
                  v-for="scale in view.scaleButtons"
                  :key="scale.value"
                  type="button"
                  :aria-pressed="scale.active"
                  :data-default-scale="scale.isDefault"
                  :class="scaleButtonClass(scale)"
                  @click="emit('scaleSelect', scale.value)"
                >
                  {{ scale.label }}
                </button>
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
