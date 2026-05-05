<script setup lang="ts">
import { computed, ref, watchEffect } from 'vue';

import type {
  EventFilterDomainView,
  EventFilterGroupView,
  EventFilterLifecycleColumnView,
  EventFiltersPanelView
} from '../stores/controlPlaneTypes.js';
import UiButton from '../ui/UiButton.vue';

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
  <div class="min-h-0 flex-1 overflow-auto bg-white">
    <div class="sticky top-0 z-10 border-b border-zinc-200 bg-white p-3">
      <div class="flex flex-wrap items-center gap-1.5">
        <UiButton class="shrink-0 px-2.5 text-xs" @click="setAllFiltersEnabled(true)">
          All
        </UiButton>
        <UiButton class="shrink-0 px-2.5 text-xs" @click="setAllFiltersEnabled(false)">
          None
        </UiButton>
        <span class="mx-0.5 h-6 w-px shrink-0 bg-zinc-200" aria-hidden="true"></span>
        <div class="contents" role="tablist" aria-label="Event filter domains">
          <UiButton
            v-for="domain in view.domains"
            :key="domain.id"
            :aria-selected="activeDomain?.id === domain.id"
            class="shrink-0 gap-1.5 px-2.5 text-xs"
            role="tab"
            :variant="domainButtonVariant(domain)"
            @click="setActiveDomain(domain.id)"
          >
            <span>{{ domain.label }}</span>
            <span
              :class="[
                'rounded px-1.5 py-0.5 text-[10px] leading-none',
                activeDomain?.id === domain.id
                  ? 'bg-white/15 text-white'
                  : 'bg-zinc-100 text-zinc-500'
              ]"
            >
              {{ domain.enabledCount }}
            </span>
          </UiButton>
        </div>
      </div>
    </div>
    <div v-if="activeDomain !== null" class="grid gap-3 p-3">
      <div v-if="activeDomain.events.length > 0" class="grid gap-2">
        <section class="rounded-lg border border-zinc-200 bg-white p-3">
          <label class="flex min-w-0 cursor-pointer items-center gap-2">
            <input
              :checked="activeDomain.eventsChecked"
              :indeterminate.prop="activeDomain.eventsIndeterminate"
              type="checkbox"
              class="h-4 w-4 rounded border-zinc-300"
              @change="onEventGroupChange(activeDomain, $event)"
            />
            <span class="min-w-0 flex-1 truncate whitespace-nowrap text-sm font-semibold">
              Events
            </span>
          </label>
          <div class="mt-2 grid gap-1 pl-6">
            <label
              v-for="type in activeDomain.events"
              :key="type.type"
              class="flex min-w-0 cursor-pointer items-center gap-1.5 rounded border border-zinc-200 bg-zinc-50 px-1.5 py-0.5 font-mono text-[10px] text-zinc-600"
            >
              <input
                :checked="type.enabled"
                type="checkbox"
                class="h-3 w-3 shrink-0 rounded border-zinc-300"
                @change="onTypeChange(type.type, $event)"
              />
              <span class="min-w-0 truncate whitespace-nowrap">{{ type.type }}</span>
            </label>
          </div>
        </section>
      </div>
      <div v-if="activeDomain.rpc.length > 0" class="grid gap-2">
        <section
          v-for="group in activeDomain.rpc"
          :key="group.id"
          class="rounded-lg border border-zinc-200 bg-white p-3"
        >
          <div class="grid grid-cols-[minmax(0,1fr)_repeat(4,1rem)] items-center gap-x-2 pr-px">
            <label class="flex min-w-0 cursor-pointer items-center gap-2">
              <input
                :checked="group.checked"
                :indeterminate.prop="group.indeterminate"
                type="checkbox"
                class="h-4 w-4 rounded border-zinc-300"
                @change="onRpcGroupChange(group, $event)"
              />
              <span class="h-3 w-3 shrink-0 rounded-sm" :style="{ background: group.color }"></span>
              <span class="min-w-0 flex-1 truncate whitespace-nowrap text-sm font-semibold">
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
              class="h-4 w-4 justify-self-center rounded-sm font-mono text-[10px] font-semibold text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-200"
              @click="onRpcLifecycleChange(lifecycle)"
            >
              {{ lifecycle.label }}
            </button>
          </div>
          <div class="mt-2 grid gap-1 pl-6">
            <div
              v-for="call in group.rpcCalls"
              :key="call.target"
              class="grid grid-cols-[minmax(0,1fr)_repeat(4,1rem)] items-center gap-x-2 rounded border border-zinc-200 bg-zinc-50 py-0.5"
            >
              <label class="flex min-w-0 cursor-pointer items-center gap-1.5 pl-1.5">
                <input
                  :checked="call.checked"
                  :indeterminate.prop="call.indeterminate"
                  type="checkbox"
                  class="h-3 w-3 shrink-0 rounded border-zinc-300"
                  @change="onRpcCallChange(call.lifecycleTypes, $event)"
                />
                <span
                  class="min-w-0 truncate whitespace-nowrap font-mono text-[10px] text-zinc-600"
                >
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
                class="h-3 w-3 justify-self-center rounded border-zinc-300"
                @change="onTypeChange(lifecycle.type, $event)"
              />
            </div>
          </div>
        </section>
      </div>
      <UiButton class="mt-1 h-9 justify-center" variant="primary" @click="emit('close')">
        Close Filters
      </UiButton>
    </div>
  </div>
</template>
