<script setup lang="ts">
import { computed } from 'vue';

type UiStatusBadgeKind = 'bad' | 'ok' | 'warn';

const props = defineProps<{
  kind: UiStatusBadgeKind;
  label: string;
}>();

const status = computed(() => {
  switch (props.kind) {
    case 'bad':
      return 'Error';
    case 'ok':
      return 'Ok';
    case 'warn':
      return 'Warning';
  }
});

const ariaLabel = computed(() => `${props.label}: ${status.value}`);
</script>

<template>
  <span class="ui-status-badge" :aria-label="ariaLabel" :data-kind="kind" tabindex="0">
    <span class="ui-status-badge__popover">
      <span class="ui-status-badge__name">{{ label }}</span>
      <span class="ui-status-badge__status">{{ status }}</span>
    </span>
  </span>
</template>

<style scoped>
@reference "tailwindcss";
.ui-status-badge {
  @apply relative block h-4 w-1.5 bg-zinc-300 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-zinc-300;
}

.ui-status-badge[data-kind='bad'] {
  @apply bg-red-500;
}

.ui-status-badge[data-kind='ok'] {
  @apply bg-emerald-500;
}

.ui-status-badge[data-kind='warn'] {
  @apply bg-amber-500;
}

.ui-status-badge__popover {
  @apply pointer-events-none invisible absolute right-0 top-6 z-20 grid w-48 gap-1 rounded border border-zinc-200 bg-white p-2 text-left text-xs font-normal leading-5 text-zinc-700 opacity-0 shadow-lg transition-opacity;
}

.ui-status-badge:hover .ui-status-badge__popover,
.ui-status-badge:focus .ui-status-badge__popover,
.ui-status-badge:focus-visible .ui-status-badge__popover {
  @apply visible opacity-100;
}

.ui-status-badge__name {
  @apply font-semibold text-zinc-950;
}

.ui-status-badge__status {
  @apply text-zinc-700;
}
</style>
