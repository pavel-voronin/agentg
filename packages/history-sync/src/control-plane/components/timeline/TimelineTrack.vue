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

function segmentClass(segment: TimelineSegment): string {
  if (segment.kind === 'coverage') {
    return `timeline-segment segment-coverage${isHighlighted(segment.key) ? ' coverage-linked-hover' : ''}`;
  }
  if (segment.kind === 'job') {
    return `timeline-segment ${segment.running ? 'segment-job-running' : 'segment-job-pending'}${isHighlighted(segment.key) ? ' timeline-linked-hover' : ''}`;
  }
  if (segment.kind === 'target-highlight') {
    return `timeline-segment segment-target-highlight${isTargetHighlightActive(segment) ? ' timeline-linked-hover' : ''}`;
  }
  if (segment.kind === 'target-union') {
    return 'timeline-segment segment-target';
  }
  return 'coverage-gap';
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
    class="relative h-12 min-w-0 flex-1 touch-none select-none overflow-hidden rounded-lg border border-zinc-200 bg-zinc-100"
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
        class="coverage-gap"
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
        :class="segmentClass(segment)"
        :style="segmentStyle(segment)"
        :tabindex="'hover' in segment ? 0 : undefined"
        @blur="emit('clearHover')"
        @focus="emit('segmentFocus', segment, $event)"
        @pointerenter="'hover' in segment ? emit('segmentHover', segment.hover) : undefined"
        @pointerleave="'hover' in segment ? emit('clearHighlight') : undefined"
      ></div>
    </template>
    <div
      class="timeline-selection"
      :class="{ 'is-active': selectionActive }"
      :style="selectionStyle"
    ></div>
  </div>
</template>
