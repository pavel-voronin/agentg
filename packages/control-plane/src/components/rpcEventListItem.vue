<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import SolarAltArrowRightBold from '~icons/solar/alt-arrow-right-bold';

import type { AppRpcEventItem, AppRpcLifecycleItem } from '../stores/controlPlaneTypes.js';
import EventBodyBlock from './eventBodyBlock.vue';

const props = defineProps<{
  event: AppRpcEventItem;
}>();

const expandedLifecycles = ref<Record<string, boolean>>({});
type EventBodyMode = 'raw' | 'yaml';

const bodyMode = ref<EventBodyMode>('yaml');
const bodyModeLabel = computed(() => (bodyMode.value === 'yaml' ? 'YAML' : 'RAW'));

watch(
  () => props.event.lifecycles,
  () => {
    const activeLifecycleKeys = new Set(props.event.lifecycles.map((lifecycle) => lifecycle.key));
    expandedLifecycles.value = Object.fromEntries(
      Object.entries(expandedLifecycles.value).filter(([key]) => activeLifecycleKeys.has(key))
    );
  }
);

function isLifecycleExpanded(lifecycle: AppRpcLifecycleItem, index: number): boolean {
  const explicit = expandedLifecycles.value[lifecycle.key];
  return typeof explicit === 'boolean' ? explicit : index === props.event.lifecycles.length - 1;
}

function toggleLifecycle(lifecycle: AppRpcLifecycleItem, index: number): void {
  expandedLifecycles.value = {
    ...expandedLifecycles.value,
    [lifecycle.key]: !isLifecycleExpanded(lifecycle, index)
  };
}

function toggleBodyMode(): void {
  bodyMode.value = bodyMode.value === 'yaml' ? 'raw' : 'yaml';
}
</script>

<template>
  <div class="rpc-event-item">
    <div class="rpc-event-item__stripe" :style="{ background: event.color }"></div>
    <div class="rpc-event-item__header">
      <div class="rpc-event-item__meta">
        <span class="rpc-event-item__kind-label"> RPC call </span>
        <span class="rpc-event-item__target">{{ event.target }}</span>
      </div>
      <button
        type="button"
        class="rpc-event-item__body-mode-button"
        :aria-label="`Switch ${event.target} body display mode`"
        :title="`Body mode: ${bodyModeLabel}`"
        @click="toggleBodyMode"
      >
        {{ bodyModeLabel }}
      </button>
    </div>
    <div class="rpc-event-item__lifecycle-list">
      <div
        v-for="(lifecycle, lifecycleIndex) in event.lifecycles"
        :key="lifecycle.key"
        class="rpc-event-item__lifecycle"
      >
        <div class="rpc-event-item__lifecycle-header">
          <button
            type="button"
            :aria-expanded="isLifecycleExpanded(lifecycle, lifecycleIndex)"
            :aria-label="
              isLifecycleExpanded(lifecycle, lifecycleIndex)
                ? `Collapse ${lifecycle.title}`
                : `Expand ${lifecycle.title}`
            "
            class="rpc-event-item__expand-button"
            @click="toggleLifecycle(lifecycle, lifecycleIndex)"
          >
            <SolarAltArrowRightBold
              class="rpc-event-item__expand-icon"
              :data-expanded="isLifecycleExpanded(lifecycle, lifecycleIndex) ? 'true' : undefined"
              aria-hidden="true"
            />
          </button>
          <span class="rpc-event-item__lifecycle-title">{{ lifecycle.title }}</span>
          <span class="rpc-event-item__lifecycle-time">{{ lifecycle.occurredAt }}</span>
        </div>
        <EventBodyBlock
          v-if="isLifecycleExpanded(lifecycle, lifecycleIndex)"
          bordered
          :body="lifecycle.body"
          :mode="bodyMode"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
@reference "tailwindcss";
.rpc-event-item {
  @apply relative border-b border-zinc-200 bg-white py-2 pl-4 pr-3 font-mono text-xs leading-relaxed transition-colors;
}

.rpc-event-item__stripe {
  @apply absolute left-0 top-0 h-full w-1.5;
}

.rpc-event-item__header {
  @apply mb-2 flex items-center gap-2;
}

.rpc-event-item__meta {
  @apply flex min-w-0 flex-1 items-center gap-2;
}

.rpc-event-item__kind-label {
  @apply shrink-0 rounded border border-zinc-300 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-normal text-zinc-500;
}

.rpc-event-item__target {
  @apply min-w-0 truncate font-semibold text-zinc-900;
}

.rpc-event-item__body-mode-button {
  @apply inline-flex h-5 shrink-0 items-center rounded border border-zinc-200 bg-white px-1.5 font-mono text-[10px] font-semibold text-zinc-500 hover:bg-zinc-50 hover:text-zinc-900;
}

.rpc-event-item__lifecycle-list {
  @apply grid gap-1;
}

.rpc-event-item__lifecycle {
  @apply rounded border border-zinc-200 bg-zinc-50 font-mono text-zinc-700 transition-colors;
}

.rpc-event-item__lifecycle-header {
  @apply flex flex-wrap items-center gap-2 px-2 py-1;
}

.rpc-event-item__expand-button {
  @apply inline-flex h-5 w-5 items-center justify-center rounded border border-zinc-300 bg-white text-zinc-500 hover:bg-zinc-50 hover:text-zinc-900;
}

.rpc-event-item__expand-icon {
  @apply h-3.5 w-3.5 transition-transform;
}

.rpc-event-item__expand-icon[data-expanded='true'] {
  @apply rotate-90;
}

.rpc-event-item__lifecycle-title {
  @apply font-semibold text-zinc-800;
}

.rpc-event-item__lifecycle-time {
  @apply text-zinc-500;
}
</style>
