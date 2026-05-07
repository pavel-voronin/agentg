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
  <div ref="panel" class="app-hover-stack" :style="{ transform }">
    <div v-for="item in items" :key="`${item.kind}:${item.key}`" class="app-hover-popover">
      <div class="font-semibold text-zinc-900">{{ item.label }}</div>
      <div class="mt-1 grid grid-cols-[auto_minmax(0,1fr)] gap-x-2 gap-y-0.5">
        <div class="text-zinc-400">from</div>
        <div class="font-mono text-zinc-700">
          <div>{{ item.from }}</div>
          <div v-if="item.fromNote" class="text-[11px] text-zinc-400">{{ item.fromNote }}</div>
        </div>
        <div class="text-zinc-400">to</div>
        <div class="font-mono text-zinc-700">
          <div>{{ item.to }}</div>
          <div v-if="item.toNote" class="text-[11px] text-zinc-400">{{ item.toNote }}</div>
        </div>
        <div class="text-zinc-400">duration</div>
        <div class="font-mono text-zinc-700">{{ item.duration }}</div>
        <template v-if="item.extra">
          <div class="text-zinc-400">
            {{ item.kind === 'coverage' ? 'messages' : 'status' }}
          </div>
          <div class="font-mono text-zinc-700">{{ item.extra }}</div>
        </template>
      </div>
    </div>
  </div>
</template>
