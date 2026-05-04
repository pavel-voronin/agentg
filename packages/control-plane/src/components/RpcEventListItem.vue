<script setup lang="ts">
import { computed, ref, watch } from 'vue';

import type { AppRpcEventItem, AppRpcLifecycleItem } from '../stores/controlPlaneTypes.js';
import EventBodyBlock from './EventBodyBlock.vue';

const props = defineProps<{
  event: AppRpcEventItem;
}>();

const emit = defineEmits<{
  clearType: [type: string];
  muteChange: [type: string, muted: boolean];
  procedureMuteToggle: [event: AppRpcEventItem];
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

function clearRpcTypes(): void {
  for (const type of props.event.lifecycleTypes) {
    emit('clearType', type);
  }
}

function toggleBodyMode(): void {
  bodyMode.value = bodyMode.value === 'yaml' ? 'raw' : 'yaml';
}
</script>

<template>
  <div
    :class="[
      'relative border-b border-zinc-200 py-2 pl-4 pr-3 font-mono text-xs leading-relaxed transition-colors',
      event.muted ? 'bg-zinc-100 text-zinc-500' : 'bg-white'
    ]"
  >
    <div
      class="absolute left-0 top-0 h-full w-1.5"
      :class="{ 'opacity-35': event.muted }"
      :style="{ background: event.color }"
    ></div>
    <div class="mb-2 flex items-center gap-2">
      <div class="flex min-w-0 flex-1 items-center gap-2">
        <span
          class="shrink-0 rounded border border-zinc-300 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-normal text-zinc-500"
        >
          RPC call
        </span>
        <span
          :class="[
            'min-w-0 truncate font-semibold',
            event.muted ? 'text-zinc-500' : 'text-zinc-900'
          ]"
        >
          {{ event.target }}
        </span>
        <button
          v-if="event.filterable"
          type="button"
          :aria-pressed="event.muted"
          :aria-label="event.muted ? `Unmute ${event.target}` : `Mute ${event.target}`"
          :title="event.muted ? `Unmute ${event.target}` : `Mute ${event.target}`"
          :class="[
            'inline-flex h-5 w-5 shrink-0 items-center justify-center rounded border text-[10px]',
            event.muted
              ? 'border-zinc-400 bg-zinc-200 text-zinc-600 hover:bg-zinc-300'
              : 'border-zinc-200 bg-white text-zinc-500 hover:bg-zinc-50 hover:text-zinc-900'
          ]"
          @click="emit('procedureMuteToggle', event)"
        >
          <svg
            class="h-3.5 w-3.5"
            viewBox="0 0 20 20"
            fill="none"
            stroke="currentColor"
            stroke-width="1.8"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <path d="M4 8.5v3h3L11 15V5L7 8.5H4Z" />
            <path v-if="event.muted" d="m14 8 3 3m0-3-3 3" />
            <path v-else d="M14 7.5a4 4 0 0 1 0 5" />
          </svg>
        </button>
        <button
          v-if="event.muted"
          type="button"
          :aria-label="`Clear ${event.target}`"
          :title="`Clear ${event.target}`"
          class="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded border border-zinc-300 bg-white text-zinc-500 hover:bg-zinc-50 hover:text-zinc-900"
          @click="clearRpcTypes"
        >
          <svg
            class="h-3.5 w-3.5"
            viewBox="0 0 20 20"
            fill="none"
            stroke="currentColor"
            stroke-width="1.8"
            stroke-linecap="round"
            aria-hidden="true"
          >
            <path d="m6 6 8 8M14 6l-8 8" />
          </svg>
        </button>
      </div>
      <button
        type="button"
        class="inline-flex h-5 shrink-0 items-center rounded border border-zinc-200 bg-white px-1.5 font-mono text-[10px] font-semibold text-zinc-500 hover:bg-zinc-50 hover:text-zinc-900"
        :aria-label="`Switch ${event.target} body display mode`"
        :title="`Body mode: ${bodyModeLabel}`"
        @click="toggleBodyMode"
      >
        {{ bodyModeLabel }}
      </button>
    </div>
    <div class="grid gap-1">
      <div
        v-for="(lifecycle, lifecycleIndex) in event.lifecycles"
        :key="lifecycle.key"
        :class="[
          'rounded border font-mono transition-colors',
          lifecycle.muted
            ? 'border-zinc-300 bg-zinc-200/70 text-zinc-500'
            : 'border-zinc-200 bg-zinc-50 text-zinc-700'
        ]"
      >
        <div class="flex flex-wrap items-center gap-2 px-2 py-1">
          <button
            type="button"
            :aria-expanded="isLifecycleExpanded(lifecycle, lifecycleIndex)"
            :aria-label="
              isLifecycleExpanded(lifecycle, lifecycleIndex)
                ? `Collapse ${lifecycle.title}`
                : `Expand ${lifecycle.title}`
            "
            class="inline-flex h-5 w-5 items-center justify-center rounded border border-zinc-300 bg-white text-zinc-500 hover:bg-zinc-50 hover:text-zinc-900"
            @click="toggleLifecycle(lifecycle, lifecycleIndex)"
          >
            <svg
              :class="[
                'h-3.5 w-3.5 transition-transform',
                isLifecycleExpanded(lifecycle, lifecycleIndex) ? 'rotate-90' : ''
              ]"
              viewBox="0 0 20 20"
              fill="currentColor"
              aria-hidden="true"
            >
              <path d="M7.5 4.75 13.25 10 7.5 15.25V4.75Z" />
            </svg>
          </button>
          <span :class="['font-semibold', lifecycle.muted ? 'text-zinc-500' : 'text-zinc-800']">
            {{ lifecycle.title }}
          </span>
          <span :class="lifecycle.muted ? 'text-zinc-400' : 'text-zinc-500'">
            {{ lifecycle.occurredAt }}
          </span>
          <button
            type="button"
            :aria-pressed="lifecycle.muted"
            :aria-label="lifecycle.muted ? `Unmute ${lifecycle.type}` : `Mute ${lifecycle.type}`"
            :title="lifecycle.muted ? `Unmute ${lifecycle.type}` : `Mute ${lifecycle.type}`"
            :class="[
              'inline-flex h-5 w-5 items-center justify-center rounded border text-[10px]',
              lifecycle.muted
                ? 'border-zinc-400 bg-zinc-200 text-zinc-600 hover:bg-zinc-300'
                : 'border-zinc-200 bg-white text-zinc-500 hover:bg-zinc-50 hover:text-zinc-900'
            ]"
            @click="emit('muteChange', lifecycle.type, !lifecycle.muted)"
          >
            <svg
              class="h-3.5 w-3.5"
              viewBox="0 0 20 20"
              fill="none"
              stroke="currentColor"
              stroke-width="1.8"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true"
            >
              <path d="M4 8.5v3h3L11 15V5L7 8.5H4Z" />
              <path v-if="lifecycle.muted" d="m14 8 3 3m0-3-3 3" />
              <path v-else d="M14 7.5a4 4 0 0 1 0 5" />
            </svg>
          </button>
          <button
            v-if="lifecycle.muted"
            type="button"
            :aria-label="`Clear ${lifecycle.type}`"
            :title="`Clear ${lifecycle.type}`"
            class="inline-flex h-5 w-5 items-center justify-center rounded border border-zinc-300 bg-white text-zinc-500 hover:bg-zinc-50 hover:text-zinc-900"
            @click="emit('clearType', lifecycle.type)"
          >
            <svg
              class="h-3.5 w-3.5"
              viewBox="0 0 20 20"
              fill="none"
              stroke="currentColor"
              stroke-width="1.8"
              stroke-linecap="round"
              aria-hidden="true"
            >
              <path d="m6 6 8 8M14 6l-8 8" />
            </svg>
          </button>
        </div>
        <EventBodyBlock
          v-if="isLifecycleExpanded(lifecycle, lifecycleIndex)"
          bordered
          :body="lifecycle.body"
          :mode="bodyMode"
          :muted="lifecycle.muted"
        />
      </div>
    </div>
  </div>
</template>
