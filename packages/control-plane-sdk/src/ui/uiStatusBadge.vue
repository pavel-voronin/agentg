<script setup lang="ts">
type UiStatusBadgeKind = 'bad' | 'ok' | 'warn';

defineProps<{
  kind: UiStatusBadgeKind;
  label: string;
}>();
</script>

<template>
  <span class="ui-status-badge" :data-kind="kind">{{ label }}</span>
</template>

<style scoped>
@reference "tailwindcss";
.ui-status-badge {
  @apply inline-flex h-6 items-center rounded border px-2 text-[11px] font-semibold leading-none;
}

.ui-status-badge[data-kind='bad'] {
  @apply border-red-500 bg-red-50 text-red-700;
}

.ui-status-badge[data-kind='ok'] {
  @apply border-emerald-500 bg-emerald-50 text-emerald-700;
}

.ui-status-badge[data-kind='warn'] {
  @apply border-amber-500 bg-amber-50 text-amber-700;
}
</style>
