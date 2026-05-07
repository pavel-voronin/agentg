<script setup lang="ts">
import { ref } from 'vue';

import type { TimelineDateLabel } from '../../timeline/timelineModel.js';

defineProps<{
  labels: TimelineDateLabel[];
}>();

const activeDeltaKey = ref<string | null>(null);
</script>

<template>
  <div class="history-date-labels">
    <span
      v-for="label in labels"
      :key="label.key"
      class="history-date-labels__item"
      :data-align="label.align"
      :style="{ width: `${String(label.widthCh)}ch` }"
      @pointerenter="activeDeltaKey = label.key"
      @pointerleave="activeDeltaKey = null"
    >
      {{ activeDeltaKey === label.key ? label.delta : label.label }}
    </span>
  </div>
</template>

<style scoped>
@reference "tailwindcss";
.history-date-labels {
  @apply flex justify-between pl-8 text-xs text-zinc-500;
}

.history-date-labels__item {
  @apply inline-block cursor-default tabular-nums;
}

.history-date-labels__item[data-align='left'] {
  @apply text-left;
}

.history-date-labels__item[data-align='right'] {
  @apply text-right;
}
</style>
