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
  addTarget: [start: string, end: string];
  clearHighlight: [];
  clearHover: [];
  clickCapture: [event: Event];
  pointerCancel: [event: Event];
  pointerDown: [event: Event];
  pointerLeave: [];
  pointerMove: [event: Event];
  pointerUp: [event: Event];
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

function isHighlighted(key: string): boolean {
  return props.highlightedKeys.includes(key);
}

function isTargetHighlightActive(segment: TimelineSegment): boolean {
  return (
    segment.kind === 'target-highlight' &&
    segment.keys.some((key) => props.highlightedKeys.includes(key))
  );
}

function segmentHighlighted(segment: TimelineSegment): boolean {
  if (segment.kind === 'coverage') {
    return isHighlighted(segment.key);
  }
  return isTargetHighlightActive(segment);
}

function segmentRunning(segment: TimelineSegment): boolean {
  return false;
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
    class="history-timeline-track"
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
        class="history-timeline-track__gap"
        :aria-label="segment.ariaLabel"
        :data-gap-end="segment.endIso"
        :data-gap-start="segment.startIso"
        :style="segmentStyle(segment)"
        type="button"
        @click.stop.prevent="emit('addTarget', segment.startIso, segment.endIso)"
      ></button>
      <div
        v-else
        :aria-label="'ariaLabel' in segment ? segment.ariaLabel : undefined"
        class="history-timeline-track__segment"
        :data-highlighted="segmentHighlighted(segment)"
        :data-kind="segment.kind"
        :data-running="segmentRunning(segment)"
        :style="segmentStyle(segment)"
        :tabindex="'hover' in segment ? 0 : undefined"
        @blur="emit('clearHover')"
        @focus="emit('segmentFocus', segment, $event)"
        @pointerenter="'hover' in segment ? emit('segmentHover', segment.hover) : undefined"
        @pointerleave="'hover' in segment ? emit('clearHighlight') : undefined"
      ></div>
    </template>
    <div
      class="history-timeline-track__selection"
      :data-active="selectionActive"
      :style="selectionStyle"
    ></div>
  </div>
</template>

<style scoped>
@reference "tailwindcss";
.history-timeline-track {
  @apply relative h-12 min-w-0 flex-1 touch-none select-none overflow-hidden rounded-lg border border-zinc-200 bg-zinc-100;
}

.history-timeline-track__segment {
  @apply absolute bottom-0 top-0 min-w-0.5;
}

.history-timeline-track__segment[data-kind='coverage'] {
  @apply z-[3] bg-emerald-500;
}

.history-timeline-track__segment[data-kind='coverage'][data-highlighted='true'] {
  @apply z-[5] bg-emerald-600;
}

.history-timeline-track__segment[data-kind='target-highlight'] {
  @apply pointer-events-none z-[8];
}

.history-timeline-track__segment[data-kind='target-highlight'][data-highlighted='true'] {
  @apply bg-[repeating-linear-gradient(135deg,rgba(21,94,117,0.9)_0,rgba(21,94,117,0.9)_2px,transparent_2px,transparent_7px)] bg-fixed;
}

.history-timeline-track__segment[data-kind='target-union'] {
  @apply pointer-events-none z-[6] bg-[repeating-linear-gradient(135deg,rgba(14,116,144,0.72)_0,rgba(14,116,144,0.72)_2px,transparent_2px,transparent_7px)] bg-fixed;
}

.history-timeline-track__gap {
  @apply absolute bottom-0 top-0 z-[4] cursor-pointer;
}

.history-timeline-track__gap:hover,
.history-timeline-track__gap:focus-visible {
  @apply z-[6] bg-[repeating-linear-gradient(135deg,rgba(14,116,144,0.3)_0,rgba(14,116,144,0.3)_2px,transparent_2px,transparent_7px)] outline-none;
}

.history-timeline-track__selection {
  @apply pointer-events-none absolute bottom-0 top-0 z-[6] hidden border-x border-sky-600 bg-sky-500/15;
}

.history-timeline-track__selection[data-active='true'] {
  @apply block;
}
</style>
