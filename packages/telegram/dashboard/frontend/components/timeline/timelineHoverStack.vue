<script setup lang="ts">
import { ref } from 'vue';

import type { TimelineHoverItem } from '../../timeline/timelineModel.js';

defineProps<{
  items: TimelineHoverItem[];
  transform: string;
}>();

type SizedElement = {
  offsetHeight: number;
  offsetWidth: number;
};

const panel = ref<SizedElement | null>(null);

defineExpose({
  get offsetHeight() {
    return panel.value?.offsetHeight ?? 0;
  },
  get offsetWidth() {
    return panel.value?.offsetWidth ?? 0;
  }
});
</script>

<template>
  <div ref="panel" class="history-coverage-hover-stack" :style="{ transform }">
    <div
      v-for="item in items"
      :key="`${item.kind}:${item.key}`"
      class="history-coverage-hover-stack__card"
    >
      <div class="history-coverage-hover-stack__title">{{ item.label }}</div>
      <div class="history-coverage-hover-stack__grid">
        <div class="history-coverage-hover-stack__label">from</div>
        <div class="history-coverage-hover-stack__value">{{ item.from }}</div>
        <div class="history-coverage-hover-stack__label">to</div>
        <div class="history-coverage-hover-stack__value">{{ item.to }}</div>
        <div class="history-coverage-hover-stack__label">duration</div>
        <div class="history-coverage-hover-stack__value">{{ item.duration }}</div>
        <template v-if="item.extra">
          <div class="history-coverage-hover-stack__label">messages</div>
          <div class="history-coverage-hover-stack__value">{{ item.extra }}</div>
        </template>
      </div>
    </div>
  </div>
</template>

<style scoped>
@reference "tailwindcss";

.history-coverage-hover-stack {
  @apply pointer-events-none fixed left-0 top-0 z-50 grid max-w-[min(36rem,calc(100vw_-_16px))] gap-1.5;
}

.history-coverage-hover-stack__card {
  @apply max-w-full whitespace-nowrap rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-900 shadow-lg;
}

.history-coverage-hover-stack__title {
  @apply font-semibold text-zinc-900;
}

.history-coverage-hover-stack__grid {
  @apply mt-1 grid grid-cols-[auto_minmax(0,1fr)] gap-x-2 gap-y-0.5;
}

.history-coverage-hover-stack__label {
  @apply text-zinc-400;
}

.history-coverage-hover-stack__value {
  @apply font-mono text-zinc-700;
}
</style>
