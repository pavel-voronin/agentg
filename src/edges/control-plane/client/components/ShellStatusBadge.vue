<script setup lang="ts">
import { computed } from 'vue';

import type { StatusBadgeView } from '../stores/controlPlaneTypes.js';

const props = defineProps<{
  badge: StatusBadgeView;
}>();

const badgeClass = computed(() => {
  const colorClass = {
    bad: 'border-zinc-400 text-zinc-500',
    ok: 'border-emerald-500 text-emerald-700',
    warn: 'border-amber-400 text-amber-700'
  }[props.badge.kind];

  return `inline-flex h-6 items-center rounded border px-2 text-[11px] font-semibold leading-none ${colorClass}`;
});
</script>

<template>
  <span :class="badgeClass">{{ badge.label }}</span>
</template>
