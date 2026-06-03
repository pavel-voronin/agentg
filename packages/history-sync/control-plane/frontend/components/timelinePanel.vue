<script setup lang="ts">
import { computed } from 'vue';
import SolarAltArrowDownBold from '~icons/solar/alt-arrow-down-bold';
import SolarAltArrowRightBold from '~icons/solar/alt-arrow-right-bold';

import type { SelectedHistorySyncState } from '../views.js';
import { useTimelineInteraction } from '../timeline/useTimelineInteraction.js';
import TimelineDateLabels from './timeline/timelineDateLabels.vue';
import TimelineDetailsTable from './timeline/timelineDetailsTable.vue';
import TimelineHoverStack from './timeline/timelineHoverStack.vue';
import TimelineTrack from './timeline/timelineTrack.vue';

const props = defineProps<{
  data: SelectedHistorySyncState;
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
  <div v-if="view" class="history-sync-timeline">
    <div class="history-sync-timeline__track-row">
      <div class="history-sync-timeline__toggle-shell">
        <button
          class="history-sync-timeline__toggle"
          :aria-expanded="coverageTableOpen"
          :aria-label="coverageTableOpen ? 'Hide timeline intervals' : 'Show timeline intervals'"
          :data-expanded="coverageTableOpen"
          type="button"
          @click="coverageTableOpen = !coverageTableOpen"
        >
          <SolarAltArrowDownBold
            v-if="coverageTableOpen"
            class="history-sync-timeline__toggle-icon"
            aria-hidden="true"
          />
          <SolarAltArrowRightBold
            v-else
            class="history-sync-timeline__toggle-icon"
            aria-hidden="true"
          />
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

    <div v-if="view.detailsEmpty" class="history-sync-timeline__empty">
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

<style scoped>
@reference "tailwindcss";
.history-sync-timeline {
  @apply grid gap-2;
}

.history-sync-timeline__track-row {
  @apply flex h-12 items-center gap-2;
}

.history-sync-timeline__toggle-shell {
  @apply flex w-6 shrink-0 items-center justify-center;
}

.history-sync-timeline__toggle {
  @apply inline-flex h-4 w-4 items-center justify-center rounded border border-zinc-300 bg-white text-[11px] font-semibold leading-none text-zinc-500 shadow-sm hover:bg-zinc-50 hover:text-zinc-700;
}

.history-sync-timeline__toggle-icon {
  @apply h-3 w-3;
}

.history-sync-timeline__empty {
  @apply mt-3 rounded-lg border border-dashed border-zinc-300 p-4 text-center text-xs text-zinc-500;
}
</style>
