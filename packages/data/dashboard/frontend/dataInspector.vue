<script setup lang="ts">
import { UiButton } from '@agentg/framework/dashboard';
import SolarCloseCircleBold from '~icons/solar/close-circle-bold';

import type { InspectorView } from './viewTypes.js';
import type { ModelRef } from '../contracts.js';

defineProps<{
  view: InspectorView;
}>();

const emit = defineEmits<{
  close: [];
  goToRef: [ref: ModelRef];
  openHref: [href: string];
  openRelatedData: [ref: ModelRef];
}>();

function actionKey(action: NonNullable<InspectorView['actions']>[number]): string {
  return action.ref === undefined
    ? `${action.label}:${action.href}`
    : `${action.label}:${action.ref._model}:${action.ref.id}`;
}

function runAction(action: NonNullable<InspectorView['actions']>[number]): void {
  if (action.ref !== undefined) {
    emit('openRelatedData', action.ref);
    return;
  }
  emit('openHref', action.href);
}
</script>

<template>
  <aside class="data-inspector">
    <header class="data-inspector__header">
      <h2 class="data-inspector__title">{{ view.title }}</h2>
      <UiButton size="icon-md" aria-label="Close inspector" @click="emit('close')">
        <SolarCloseCircleBold class="data-inspector__icon" aria-hidden="true" />
      </UiButton>
    </header>

    <div class="data-inspector__body">
      <div
        v-if="view.actions !== undefined && view.actions.length > 0"
        class="data-inspector__actions"
      >
        <button
          v-for="action in view.actions"
          :key="actionKey(action)"
          type="button"
          class="data-inspector__action"
          @click="runAction(action)"
        >
          {{ action.label }}
        </button>
      </div>

      <dl class="data-inspector__meta">
        <template v-for="item in view.fields" :key="item.label">
          <dt class="data-inspector__meta-label">{{ item.label }}</dt>
          <dd class="data-inspector__meta-value">
            <button
              v-if="item.ref !== undefined"
              type="button"
              class="data-inspector__meta-link"
              @click="emit('goToRef', item.ref)"
            >
              {{ item.value }}
            </button>
            <template v-else>{{ item.value }}</template>
          </dd>
        </template>
      </dl>
    </div>
  </aside>
</template>

<style scoped>
@reference "tailwindcss";

.data-inspector {
  @apply flex min-h-0 flex-col overflow-hidden overscroll-none border-t border-zinc-200 bg-white xl:border-l xl:border-t-0;
}

.data-inspector__header {
  @apply flex h-10 shrink-0 items-center justify-between gap-3 border-b border-zinc-200 bg-white px-4;
}

.data-inspector__title {
  @apply truncate text-sm font-semibold text-zinc-900;
}

.data-inspector__icon {
  @apply h-4 w-4;
}

.data-inspector__body {
  @apply flex min-h-0 flex-1 flex-col overflow-auto overscroll-none;
}

.data-inspector__actions {
  @apply flex shrink-0 flex-wrap gap-2 border-b border-zinc-200 px-4 py-3;
}

.data-inspector__action {
  @apply h-7 border border-zinc-300 bg-white px-3 text-xs font-semibold text-zinc-700 hover:border-teal-500 hover:text-teal-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500;
}

.data-inspector__meta {
  @apply grid grid-cols-[6rem_minmax(0,1fr)] gap-x-3 gap-y-2 border-b border-zinc-200 px-4 py-4 text-xs;
}

.data-inspector__meta-label {
  @apply text-zinc-500;
}

.data-inspector__meta-value {
  @apply min-w-0 break-words text-zinc-800;
}

.data-inspector__meta-link {
  @apply max-w-full break-words bg-transparent p-0 text-left font-mono text-[11px] text-teal-700 hover:text-teal-950 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500;
}
</style>
