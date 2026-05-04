<script setup lang="ts">
import { ref } from 'vue';

import type { TimelineDateLabel } from '../../timeline/timelineModel.js';

defineProps<{
  labels: TimelineDateLabel[];
}>();

const activeDeltaKey = ref<string | null>(null);
</script>

<template>
  <div class="flex justify-between pl-8 text-xs text-zinc-500">
    <span
      v-for="label in labels"
      :key="label.key"
      class="inline-block cursor-default tabular-nums"
      :class="label.align === 'right' ? 'text-right' : 'text-left'"
      :style="{ width: `${String(label.widthCh)}ch` }"
      @pointerenter="activeDeltaKey = label.key"
      @pointerleave="activeDeltaKey = null"
    >
      {{ activeDeltaKey === label.key ? label.delta : label.label }}
    </span>
  </div>
</template>
