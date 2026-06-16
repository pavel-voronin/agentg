<script setup lang="ts">
import { ref } from 'vue';

import type { TimelineHoverItem, TimelineSegment } from '../../timeline/timelineModel.js';

const props = defineProps<{
  highlightedKeys: string[];
  segments: TimelineSegment[];
  selectionActive: boolean;
  selectionStyle: Record<string, string>;
}>();

const emit = defineEmits<{
  clearHighlight: [];
  clearHover: [];
  clickCapture: [event: Event];
  pointerCancel: [event: Event];
  pointerDown: [event: Event];
  pointerLeave: [];
  pointerMove: [event: Event];
  pointerUp: [event: Event];
  rangeSelect: [start: string, end: string];
  segmentFocus: [segment: TimelineSegment, event: Event];
  segmentHover: [item: TimelineHoverItem];
  wheel: [event: Event];
}>();

type Rect = {
  height: number;
  left: number;
  top: number;
  width: number;
};

type TrackElement = {
  getBoundingClientRect: () => Rect;
  releasePointerCapture?: (pointerId: number) => void;
  setPointerCapture?: (pointerId: number) => void;
};

const track = ref<TrackElement | null>(null);

function segmentHighlighted(segment: TimelineSegment): boolean {
  return segment.kind === 'coverage' && props.highlightedKeys.includes(segment.key);
}

function segmentStyle(segment: TimelineSegment): Record<string, string> {
  return {
    left: `${String(segment.position.left)}%`,
    width: `${String(segment.position.width)}%`
  };
}

defineExpose({
  getBoundingClientRect() {
    return (
      track.value?.getBoundingClientRect() ?? {
        height: 0,
        left: 0,
        top: 0,
        width: 0
      }
    );
  },
  releasePointerCapture(pointerId: number) {
    track.value?.releasePointerCapture?.(pointerId);
  },
  setPointerCapture(pointerId: number) {
    track.value?.setPointerCapture?.(pointerId);
  }
});
</script>

<template>
  <div
    ref="track"
    class="history-coverage-timeline-track"
    @click.capture="emit('clickCapture', $event)"
    @pointercancel="emit('pointerCancel', $event)"
    @pointerdown="emit('pointerDown', $event)"
    @pointerleave="emit('pointerLeave')"
    @pointermove="emit('pointerMove', $event)"
    @pointerup="emit('pointerUp', $event)"
    @wheel="emit('wheel', $event)"
  >
    <template v-for="segment in segments" :key="segment.key">
      <button
        v-if="segment.kind === 'gap'"
        class="history-coverage-timeline-track__gap"
        :aria-label="segment.ariaLabel"
        :data-gap-end="segment.endIso"
        :data-gap-start="segment.startIso"
        :style="segmentStyle(segment)"
        type="button"
        @click.stop.prevent="emit('rangeSelect', segment.startIso, segment.endIso)"
      ></button>
      <div
        v-else
        :aria-label="segment.ariaLabel"
        class="history-coverage-timeline-track__segment"
        :data-highlighted="segmentHighlighted(segment)"
        :data-kind="segment.kind"
        :style="segmentStyle(segment)"
        tabindex="0"
        @blur="emit('clearHover')"
        @focus="emit('segmentFocus', segment, $event)"
        @pointerenter="emit('segmentHover', segment.hover)"
        @pointerleave="emit('clearHighlight')"
      ></div>
    </template>
    <div
      class="history-coverage-timeline-track__selection"
      :data-active="selectionActive"
      :style="selectionStyle"
    ></div>
  </div>
</template>

<style scoped>
@reference "tailwindcss";

.history-coverage-timeline-track {
  @apply relative h-12 min-w-0 flex-1 touch-none select-none overflow-hidden rounded-lg border border-zinc-200 bg-zinc-100;
}

.history-coverage-timeline-track__segment {
  @apply absolute bottom-0 top-0 min-w-0.5;
}

.history-coverage-timeline-track__segment[data-kind='coverage'] {
  @apply z-[3] bg-emerald-500;
}

.history-coverage-timeline-track__segment[data-kind='coverage'][data-highlighted='true'] {
  @apply z-[5] bg-emerald-600;
}

.history-coverage-timeline-track__gap {
  @apply absolute bottom-0 top-0 z-[4] cursor-pointer;
}

.history-coverage-timeline-track__gap:hover,
.history-coverage-timeline-track__gap:focus-visible {
  @apply z-[6] bg-[repeating-linear-gradient(135deg,rgba(14,116,144,0.3)_0,rgba(14,116,144,0.3)_2px,transparent_2px,transparent_7px)] outline-none;
}

.history-coverage-timeline-track__selection {
  @apply pointer-events-none absolute bottom-0 top-0 z-[6] hidden border-x border-sky-600 bg-sky-500/15;
}

.history-coverage-timeline-track__selection[data-active='true'] {
  @apply block;
}
</style>
