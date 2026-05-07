<script setup lang="ts">
import { computed } from 'vue';

import type { SelectedHistoryState } from '@agentg/shared/control-plane/views';
import { useTimelineInteraction } from '../timeline/useTimelineInteraction.js';
import TimelineDateLabels from './timeline/TimelineDateLabels.vue';
import TimelineDetailsTable from './timeline/TimelineDetailsTable.vue';
import TimelineHoverStack from './timeline/TimelineHoverStack.vue';
import TimelineTrack from './timeline/TimelineTrack.vue';

const props = defineProps<{
  data: SelectedHistoryState;
  viewportDays: number | null;
}>();

const emit = defineEmits<{
  addTarget: [start: string, end: string];
  deleteTarget: [targetId: string];
  freeformScale: [];
}>();

const {
  clearHighlight,
  clearHover,
  coverageTableOpen,
  highlightedKeys,
  hoverItems,
  hoverPanel,
  hoverTransform,
  onDetailFocus,
  onDetailHover,
  onSegmentFocus,
  onSegmentHover,
  onTrackClickCapture,
  onTrackPointerCancel,
  onTrackPointerDown,
  onTrackPointerLeave,
  onTrackPointerMove,
  onTrackPointerUp,
  onTrackWheel,
  selectionBox,
  selectionStyle,
  track,
  view
} = useTimelineInteraction({
  data: computed(() => props.data),
  onAddTarget(start, end) {
    emit('addTarget', start, end);
  },
  onFreeformScale() {
    emit('freeformScale');
  },
  viewportDays: computed(() => props.viewportDays)
});
</script>

<template>
  <div v-if="view" class="grid gap-2">
    <div class="flex h-12 items-center gap-2">
      <div class="flex w-6 shrink-0 items-center justify-center">
        <button
          class="inline-flex h-4 w-4 items-center justify-center rounded border border-zinc-300 bg-white text-[11px] font-semibold leading-none text-zinc-500 shadow-sm hover:bg-zinc-50 hover:text-zinc-700"
          :aria-expanded="coverageTableOpen"
          :aria-label="coverageTableOpen ? 'Hide timeline intervals' : 'Show timeline intervals'"
          type="button"
          @click="coverageTableOpen = !coverageTableOpen"
        >
          <svg
            class="h-3 w-3"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <path v-if="coverageTableOpen" d="M4 6l4 4 4-4" />
            <path v-else d="M6 4l4 4-4 4" />
          </svg>
        </button>
      </div>
      <TimelineTrack
        ref="track"
        :highlighted-keys="highlightedKeys"
        :segments="view.segments"
        :selection-active="selectionBox.active"
        :selection-style="selectionStyle"
        @add-target="(start, end) => emit('addTarget', start, end)"
        @clear-highlight="clearHighlight"
        @clear-hover="clearHover"
        @click-capture="onTrackClickCapture"
        @pointer-cancel="onTrackPointerCancel"
        @pointer-down="onTrackPointerDown"
        @pointer-leave="onTrackPointerLeave"
        @pointer-move="onTrackPointerMove"
        @pointer-up="onTrackPointerUp"
        @segment-focus="onSegmentFocus"
        @segment-hover="onSegmentHover"
        @wheel="onTrackWheel"
      />
    </div>

    <TimelineDateLabels :labels="view.dateLabels" />

    <div
      v-if="view.detailsEmpty"
      class="mt-3 rounded-lg border border-dashed border-zinc-300 p-4 text-center text-xs text-zinc-500"
    >
      No history items in the current scale.
    </div>

    <TimelineDetailsTable
      v-else-if="coverageTableOpen"
      :highlighted-keys="highlightedKeys"
      :sections="view.detailSections"
      @clear-highlight="clearHighlight"
      @clear-hover="clearHover"
      @delete-target="(targetId) => emit('deleteTarget', targetId)"
      @detail-focus="onDetailFocus"
      @detail-hover="onDetailHover"
    />

    <TimelineHoverStack
      v-if="hoverItems.length > 0"
      ref="hoverPanel"
      :items="hoverItems"
      :transform="hoverTransform"
    />
  </div>
</template>
