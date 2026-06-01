<script setup lang="ts">
import { computed, ref, watchEffect } from 'vue';

import type {
  EventFilterDomainView,
  EventFilterGroupView,
  EventFilterLifecycleColumnView,
  EventFiltersPanelView
} from '../stores/controlPlaneTypes.js';
import { UiButton } from '@agentg/framework/cp';

const props = defineProps<{
  view: EventFiltersPanelView;
}>();

const emit = defineEmits<{
  close: [];
  typeChange: [type: string, enabled: boolean];
}>();

type InputEventTarget = {
  checked: boolean;
};

const activeDomainId = ref<string | null>(null);
const activeDomain = computed(
  () =>
    props.view.domains.find((domain) => domain.id === activeDomainId.value) ??
    props.view.domains[0] ??
    null
);
const allFilterTypes = computed(() => [
  ...new Set(
    props.view.domains.flatMap((domain) => [
      ...domain.eventTypes,
      ...domain.rpc.flatMap((group) => group.rpcCalls.flatMap((call) => call.lifecycleTypes))
    ])
  )
]);

watchEffect(() => {
  const firstDomain = props.view.domains[0];
  if (firstDomain === undefined) {
    activeDomainId.value = null;
    return;
  }
  if (!props.view.domains.some((domain) => domain.id === activeDomainId.value)) {
    activeDomainId.value = firstDomain.id;
  }
});

function setActiveDomain(domainId: string): void {
  activeDomainId.value = domainId;
}

function setAllFiltersEnabled(enabled: boolean): void {
  for (const type of allFilterTypes.value) {
    emit('typeChange', type, enabled);
  }
}

function domainButtonVariant(domain: EventFilterDomainView): 'neutral' | 'selected' {
  return activeDomain.value?.id === domain.id ? 'selected' : 'neutral';
}

function onTypeChange(type: string, event: Event): void {
  const input = inputTarget(event);
  if (input !== null) {
    emit('typeChange', type, input.checked);
  }
}

function onEventGroupChange(domain: EventFilterDomainView, event: Event): void {
  const input = inputTarget(event);
  if (input === null) {
    return;
  }
  for (const type of domain.eventTypes) {
    emit('typeChange', type, input.checked);
  }
}

function onRpcCallChange(types: string[], event: Event): void {
  const input = inputTarget(event);
  if (input === null) {
    return;
  }
  for (const type of types) {
    emit('typeChange', type, input.checked);
  }
}

function onRpcGroupChange(group: EventFilterGroupView, event: Event): void {
  const input = inputTarget(event);
  if (input === null) {
    return;
  }
  for (const call of group.rpcCalls) {
    for (const type of call.lifecycleTypes) {
      emit('typeChange', type, input.checked);
    }
  }
}

function onRpcLifecycleChange(lifecycle: EventFilterLifecycleColumnView): void {
  const enabled = !lifecycle.checked;
  for (const type of lifecycle.types) {
    emit('typeChange', type, enabled);
  }
}

function inputTarget(event: Event): InputEventTarget | null {
  return event.target === null ? null : (event.target as unknown as InputEventTarget);
}
</script>

<template>
  <div class="event-filters">
    <div class="event-filters__toolbar">
      <div class="event-filters__toolbar-layout">
        <UiButton class="event-filters__toolbar-button" @click="setAllFiltersEnabled(true)">
          All
        </UiButton>
        <UiButton class="event-filters__toolbar-button" @click="setAllFiltersEnabled(false)">
          None
        </UiButton>
        <span class="event-filters__toolbar-separator" aria-hidden="true"></span>
        <div class="event-filters__domain-tabs" role="tablist" aria-label="Event filter domains">
          <UiButton
            v-for="domain in view.domains"
            :key="domain.id"
            :aria-selected="activeDomain?.id === domain.id"
            class="event-filters__domain-button"
            role="tab"
            :variant="domainButtonVariant(domain)"
            @click="setActiveDomain(domain.id)"
          >
            <span>{{ domain.label }}</span>
            <span
              class="event-filters__domain-count"
              :data-active="activeDomain?.id === domain.id ? 'true' : undefined"
            >
              {{ domain.enabledCount }}
            </span>
          </UiButton>
        </div>
      </div>
    </div>
    <div v-if="activeDomain !== null" class="event-filters__body">
      <div v-if="activeDomain.events.length > 0" class="event-filters__group-list">
        <section class="event-filters__group">
          <label class="event-filters__group-label">
            <input
              :checked="activeDomain.eventsChecked"
              :indeterminate.prop="activeDomain.eventsIndeterminate"
              type="checkbox"
              class="event-filters__group-checkbox"
              @change="onEventGroupChange(activeDomain, $event)"
            />
            <span class="event-filters__group-title"> Events </span>
          </label>
          <div class="event-filters__type-list">
            <label
              v-for="type in activeDomain.events"
              :key="type.type"
              class="event-filters__type-row"
            >
              <input
                :checked="type.enabled"
                type="checkbox"
                class="event-filters__type-checkbox"
                @change="onTypeChange(type.type, $event)"
              />
              <span class="event-filters__type-label">{{ type.type }}</span>
            </label>
          </div>
        </section>
      </div>
      <div v-if="activeDomain.rpc.length > 0" class="event-filters__group-list">
        <section v-for="group in activeDomain.rpc" :key="group.id" class="event-filters__group">
          <div class="event-filters__rpc-group-header">
            <label class="event-filters__group-label">
              <input
                :checked="group.checked"
                :indeterminate.prop="group.indeterminate"
                type="checkbox"
                class="event-filters__group-checkbox"
                @change="onRpcGroupChange(group, $event)"
              />
              <span class="event-filters__group-color" :style="{ background: group.color }"></span>
              <span class="event-filters__group-title">
                {{ group.label }}
              </span>
            </label>
            <button
              v-for="lifecycle in group.lifecycleColumns"
              :key="lifecycle.suffix"
              :aria-label="`Toggle ${lifecycle.title} RPC calls`"
              :aria-pressed="lifecycle.indeterminate ? 'mixed' : lifecycle.checked"
              :title="lifecycle.title"
              type="button"
              class="event-filters__lifecycle-toggle"
              @click="onRpcLifecycleChange(lifecycle)"
            >
              {{ lifecycle.label }}
            </button>
          </div>
          <div class="event-filters__type-list">
            <div
              v-for="call in group.rpcCalls"
              :key="call.target"
              class="event-filters__rpc-call-row"
            >
              <label class="event-filters__rpc-call-label">
                <input
                  :checked="call.checked"
                  :indeterminate.prop="call.indeterminate"
                  type="checkbox"
                  class="event-filters__type-checkbox"
                  @change="onRpcCallChange(call.lifecycleTypes, $event)"
                />
                <span class="event-filters__rpc-call-title">
                  {{ call.target }}
                </span>
              </label>
              <input
                v-for="lifecycle in call.lifecycles"
                :key="lifecycle.type"
                :aria-label="`${call.target} ${lifecycle.title}`"
                :checked="lifecycle.enabled"
                :title="`${call.target} ${lifecycle.title}`"
                type="checkbox"
                class="event-filters__lifecycle-checkbox"
                @change="onTypeChange(lifecycle.type, $event)"
              />
            </div>
          </div>
        </section>
      </div>
      <UiButton class="event-filters__close-button" variant="primary" @click="emit('close')">
        Close Filters
      </UiButton>
    </div>
  </div>
</template>

<style scoped>
@reference "tailwindcss";
.event-filters {
  @apply min-h-0 flex-1 overflow-auto bg-white;
}

.event-filters__toolbar {
  @apply sticky top-0 z-10 border-b border-zinc-200 bg-white p-3;
}

.event-filters__toolbar-layout {
  @apply flex flex-wrap items-center gap-1.5;
}

.event-filters__toolbar-button {
  @apply shrink-0 px-2.5 text-xs;
}

.event-filters__toolbar-separator {
  @apply mx-0.5 h-6 w-px shrink-0 bg-zinc-200;
}

.event-filters__domain-tabs {
  @apply contents;
}

.event-filters__domain-button {
  @apply shrink-0 gap-1.5 px-2.5 text-xs;
}

.event-filters__domain-count {
  @apply rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] leading-none text-zinc-500;
}

.event-filters__domain-count[data-active='true'] {
  @apply bg-white/15 text-white;
}

.event-filters__body {
  @apply grid gap-3 p-3;
}

.event-filters__group-list {
  @apply grid gap-2;
}

.event-filters__group {
  @apply rounded-lg border border-zinc-200 bg-white p-3;
}

.event-filters__group-label {
  @apply flex min-w-0 cursor-pointer items-center gap-2;
}

.event-filters__group-checkbox {
  @apply h-4 w-4 rounded border-zinc-300;
}

.event-filters__group-title {
  @apply min-w-0 flex-1 truncate whitespace-nowrap text-sm font-semibold;
}

.event-filters__type-list {
  @apply mt-2 grid gap-1 pl-6;
}

.event-filters__type-row {
  @apply flex min-w-0 cursor-pointer items-center gap-1.5 rounded border border-zinc-200 bg-zinc-50 px-1.5 py-0.5 font-mono text-[10px] text-zinc-600;
}

.event-filters__type-checkbox {
  @apply h-3 w-3 shrink-0 rounded border-zinc-300;
}

.event-filters__type-label {
  @apply min-w-0 truncate whitespace-nowrap;
}

.event-filters__rpc-group-header {
  @apply grid grid-cols-[minmax(0,1fr)_repeat(4,1rem)] items-center gap-x-2 pr-px;
}

.event-filters__group-color {
  @apply h-3 w-3 shrink-0 rounded-sm;
}

.event-filters__lifecycle-toggle {
  @apply h-4 w-4 justify-self-center rounded-sm font-mono text-[10px] font-semibold text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-200;
}

.event-filters__rpc-call-row {
  @apply grid grid-cols-[minmax(0,1fr)_repeat(4,1rem)] items-center gap-x-2 rounded border border-zinc-200 bg-zinc-50 py-0.5;
}

.event-filters__rpc-call-label {
  @apply flex min-w-0 cursor-pointer items-center gap-1.5 pl-1.5;
}

.event-filters__rpc-call-title {
  @apply min-w-0 truncate whitespace-nowrap font-mono text-[10px] text-zinc-600;
}

.event-filters__lifecycle-checkbox {
  @apply h-3 w-3 justify-self-center rounded border-zinc-300;
}

.event-filters__close-button {
  @apply mt-1 h-9 justify-center;
}
</style>
