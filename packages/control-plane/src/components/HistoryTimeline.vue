<script setup lang="ts">
import { computed, nextTick, reactive, ref, watch } from 'vue';

import type { SelectedHistoryState } from '../stores/controlPlaneStore.js';
import {
  TIMELINE_MIN_WINDOW_MS,
  TIMELINE_SELECTION_MIN_PX,
  TIMELINE_WHEEL_AXIS_DOMINANCE,
  TIMELINE_WHEEL_AXIS_INTENT_PX,
  TIMELINE_WHEEL_GESTURE_IDLE_MS,
  buildTimelineViewModel,
  clamp,
  clampTimelineViewport,
  historyItemsAtTime,
  timelinePhysicalBounds,
  timelineViewportFromPreset,
  type TimelineDetail,
  type TimelineHoverItem,
  type TimelineSegment,
  type TimelineViewport
} from '../timeline/timelineModel.js';

const props = defineProps<{
  data: SelectedHistoryState;
  viewportDays: number | null;
}>();

const emit = defineEmits<{
  addTarget: [start: string, end: string];
  deleteTarget: [targetId: string];
  freeformScale: [];
}>();

type ElementLike = {
  closest?: (selector: string) => unknown;
};

type PointerLikeEvent = {
  altKey?: boolean;
  button?: number;
  clientX: number;
  clientY: number;
  pointerId: number;
  preventDefault: () => void;
  releasePointerCapture?: (pointerId: number) => void;
  setPointerCapture?: (pointerId: number) => void;
  stopPropagation: () => void;
  target: unknown;
};

type Rect = {
  height: number;
  left: number;
  top: number;
  width: number;
};

type SizedElement = {
  getBoundingClientRect: () => Rect;
  offsetHeight: number;
  offsetWidth: number;
  releasePointerCapture?: (pointerId: number) => void;
  setPointerCapture?: (pointerId: number) => void;
};

type WheelLikeEvent = PointerLikeEvent & {
  deltaX: number;
  deltaY: number;
};

type TimelineSelection = {
  clickGapEnd: string | null;
  clickGapStart: string | null;
  maxAt: number;
  minAt: number;
  pointerId: number;
  startX: number;
  trackWidth: number;
};

type WheelGesture = {
  axis: 'horizontal' | 'vertical' | null;
  deltaX: number;
  deltaY: number;
  timeoutId: ReturnType<typeof setTimeout> | undefined;
};

const coverageTableOpen = ref(false);
const dateDeltaKey = ref<string | null>(null);
const highlightedKeys = ref<string[]>([]);
const hoverItems = ref<TimelineHoverItem[]>([]);
const hoverPanel = ref<SizedElement | null>(null);
const hoverTransform = ref('translate(0px, 0px)');
const selection = ref<TimelineSelection | null>(null);
const suppressTimelineClick = ref(false);
const activeChatId = ref<string | null>(null);
const lastViewportDays = ref<number | null | undefined>(undefined);
const timelineViewport = ref<TimelineViewport | null>(null);
const track = ref<SizedElement | null>(null);
const wheelGesture = ref<WheelGesture | null>(null);
const selectionBox = reactive({
  active: false,
  left: 0,
  width: 0
});

const view = computed(() =>
  timelineViewport.value === null
    ? null
    : buildTimelineViewModel({
        coverageTableOpen: coverageTableOpen.value,
        data: props.data,
        viewport: timelineViewport.value
      })
);

const selectionStyle = computed(() => ({
  left: `${String(selectionBox.left)}px`,
  width: `${String(selectionBox.width)}px`
}));

watch(
  () => [props.data, props.viewportDays] as const,
  () => {
    const nextChatId = props.data.chat?.id ?? null;
    const chatChanged = activeChatId.value !== nextChatId;
    const scaleChanged = lastViewportDays.value !== props.viewportDays;
    if (chatChanged) {
      activeChatId.value = nextChatId;
      coverageTableOpen.value = false;
    }
    syncViewport({ resetToPreset: chatChanged || scaleChanged });
    lastViewportDays.value = props.viewportDays;
    clearHover();
  },
  { immediate: true }
);

function clearHighlight(): void {
  highlightedKeys.value = [];
}

function clearHover(): void {
  hoverItems.value = [];
  clearHighlight();
}

function detailHoverItem(detail: TimelineDetail): TimelineHoverItem {
  return {
    duration: detail.duration,
    extra:
      detail.type === 'coverage'
        ? (detail.count ?? '')
        : detail.type === 'job'
          ? (detail.status ?? '')
          : '',
    from: detail.startValue,
    key: detail.key,
    kind: detail.type,
    label: detail.type === 'target' ? 'Target' : detail.type === 'job' ? 'Job' : 'Coverage',
    to: detail.endValue,
    ...(detail.startNote === undefined ? {} : { fromNote: detail.startNote }),
    ...(detail.endNote === undefined ? {} : { toNote: detail.endNote })
  };
}

function dominantTimelineWheelAxis(
  deltaX: number,
  deltaY: number
): 'horizontal' | 'vertical' | null {
  const absoluteX = Math.abs(deltaX);
  const absoluteY = Math.abs(deltaY);
  if (Math.max(absoluteX, absoluteY) < TIMELINE_WHEEL_AXIS_INTENT_PX) {
    return null;
  }
  if (absoluteY >= absoluteX * TIMELINE_WHEEL_AXIS_DOMINANCE) {
    return 'vertical';
  }
  if (absoluteX >= absoluteY * TIMELINE_WHEEL_AXIS_DOMINANCE) {
    return 'horizontal';
  }
  return null;
}

function finishTimelineSelection(event: PointerLikeEvent): void {
  const current = selection.value;
  const currentTrack = track.value;
  if (!current || !currentTrack || current.pointerId !== event.pointerId) return;
  const rect = currentTrack.getBoundingClientRect();
  const endX = clamp(event.clientX - rect.left, 0, rect.width);
  const width = Math.abs(endX - current.startX);
  cancelTimelineSelection(event.pointerId);
  if (width < TIMELINE_SELECTION_MIN_PX || current.trackWidth <= 0) {
    if (current.clickGapStart && current.clickGapEnd) {
      emit('addTarget', current.clickGapStart, current.clickGapEnd);
    }
    return;
  }
  suppressTimelineClick.value = true;
  setTimeout(() => {
    suppressTimelineClick.value = false;
  }, 250);
  const leftRatio = Math.min(current.startX, endX) / current.trackWidth;
  const rightRatio = Math.max(current.startX, endX) / current.trackWidth;
  const span = current.maxAt - current.minAt;
  const startAt = new Date(current.minAt + span * leftRatio);
  const endAt = new Date(current.minAt + span * rightRatio);
  emit('addTarget', startAt.toISOString(), endAt.toISOString());
}

function gapPointerDown(_segment: TimelineSegment, event: Event): void {
  event.stopPropagation();
}

function globalWindowSize(): { height: number; width: number } {
  const browserWindow = globalThis as unknown as { innerHeight?: number; innerWidth?: number };
  return {
    height: browserWindow.innerHeight ?? 0,
    width: browserWindow.innerWidth ?? 0
  };
}

function hasClosest(target: unknown, selector: string): boolean {
  const element = target as ElementLike | null;
  return typeof element?.closest === 'function' && element.closest(selector) !== null;
}

function highlightItems(items: TimelineHoverItem[]): void {
  highlightedKeys.value = items.map((item) => item.key);
}

function isHighlighted(key: string): boolean {
  return highlightedKeys.value.includes(key);
}

function isTargetHighlightActive(segment: TimelineSegment): boolean {
  return (
    segment.kind === 'target-highlight' &&
    segment.keys.some((key) => highlightedKeys.value.includes(key))
  );
}

function onDetailFocus(detail: TimelineDetail, event: Event): void {
  const item = detailHoverItem(detail);
  hoverItems.value = [item];
  highlightItems([item]);
  positionHoverFromEvent(event);
}

function onSegmentFocus(segment: TimelineSegment, event: Event): void {
  if (!('hover' in segment)) return;
  hoverItems.value = [segment.hover];
  highlightItems([segment.hover]);
  positionHoverFromEvent(event);
}

function onTrackClickCapture(event: Event): void {
  if (!suppressTimelineClick.value) return;
  event.preventDefault();
  event.stopPropagation();
  suppressTimelineClick.value = false;
}

function onTrackPointerCancel(event: Event): void {
  cancelTimelineSelection(pointerEvent(event).pointerId);
}

function onTrackPointerDown(event: Event): void {
  const pointer = pointerEvent(event);
  if (pointer.button !== 0) return;
  if (!pointer.altKey && hasClosest(pointer.target, '.segment-coverage')) {
    return;
  }
  const model = view.value;
  const currentTrack = track.value;
  if (!model || !currentTrack) return;
  pointer.preventDefault();
  clearHover();
  const rect = currentTrack.getBoundingClientRect();
  const startX = clamp(pointer.clientX - rect.left, 0, rect.width);
  const gap = pointer.target as ElementLike | null;
  const gapElement = gap?.closest?.('.coverage-gap') as {
    getAttribute?: (name: string) => string | null;
  } | null;
  selection.value = {
    clickGapEnd: gapElement?.getAttribute?.('data-gap-end') ?? null,
    clickGapStart: gapElement?.getAttribute?.('data-gap-start') ?? null,
    maxAt: model.max.getTime(),
    minAt: model.min.getTime(),
    pointerId: pointer.pointerId,
    startX,
    trackWidth: rect.width
  };
  currentTrack.setPointerCapture?.(pointer.pointerId);
}

function onTrackPointerLeave(): void {
  clearHover();
}

function onTrackPointerMove(event: Event): void {
  const pointer = pointerEvent(event);
  const current = selection.value;
  if (current && current.pointerId === pointer.pointerId) {
    const currentTrack = track.value;
    if (!currentTrack) return;
    const rect = currentTrack.getBoundingClientRect();
    const currentX = clamp(pointer.clientX - rect.left, 0, rect.width);
    if (Math.abs(currentX - current.startX) < TIMELINE_SELECTION_MIN_PX) {
      return;
    }
    updateTimelineSelection(current.startX, currentX);
    return;
  }

  const model = view.value;
  const currentTrack = track.value;
  if (!model || !currentTrack) return;
  if (pointer.altKey || selection.value) {
    clearHover();
    return;
  }
  const rect = currentTrack.getBoundingClientRect();
  if (rect.width <= 0) return;
  const ratio = clamp((pointer.clientX - rect.left) / rect.width, 0, 1);
  const at = model.min.getTime() + (model.max.getTime() - model.min.getTime()) * ratio;
  const items = historyItemsAtTime(props.data, model.min, model.max, at);
  if (items.length === 0) {
    clearHover();
    return;
  }
  hoverItems.value = items;
  highlightItems(items);
  positionHover(pointer.clientX, pointer.clientY);
}

function onTrackPointerUp(event: Event): void {
  finishTimelineSelection(pointerEvent(event));
}

function onTrackWheel(event: Event): void {
  const wheel = wheelEvent(event);
  const axis = timelineWheelGestureAxis(wheel);
  if (axis === null) {
    wheel.preventDefault();
    return;
  }
  if (axis === 'vertical') {
    zoomTimelineViewport(wheel);
    return;
  }
  panTimelineViewport(wheel);
}

function panTimelineViewport(event: WheelLikeEvent): void {
  const model = view.value;
  const currentTrack = track.value;
  if (!model || !currentTrack) return;
  event.preventDefault();
  const rect = currentTrack.getBoundingClientRect();
  if (rect.width <= 0) return;
  const span = model.max.getTime() - model.min.getTime();
  const shift = (event.deltaX / rect.width) * span;
  const physical = timelinePhysicalBounds(props.data);
  emit('freeformScale');
  timelineViewport.value = clampTimelineViewport(
    {
      endAt: model.max.getTime() + shift,
      startAt: model.min.getTime() + shift
    },
    physical
  );
}

function pointerEvent(event: Event): PointerLikeEvent {
  return event as unknown as PointerLikeEvent;
}

function positionHover(x: number, y: number): void {
  void nextTick(() => {
    const panel = hoverPanel.value;
    if (!panel) return;
    const padding = 8;
    const offset = 12;
    let left = x + offset;
    let top = y + offset;
    const { height, width } = globalWindowSize();
    if (left + panel.offsetWidth > width - padding) {
      left = x - panel.offsetWidth - offset;
    }
    if (top + panel.offsetHeight > height - padding) {
      top = y - panel.offsetHeight - offset;
    }
    hoverTransform.value = `translate(${String(Math.max(padding, left))}px, ${String(Math.max(padding, top))}px)`;
  });
}

function positionHoverFromEvent(event: Event): void {
  const pointer = pointerEvent(event);
  positionHover(pointer.clientX, pointer.clientY);
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

function syncViewport(options: { resetToPreset: boolean }): void {
  if (props.viewportDays !== null && (options.resetToPreset || timelineViewport.value === null)) {
    timelineViewport.value = timelineViewportFromPreset(props.data, props.viewportDays);
    return;
  }
  const physical = timelinePhysicalBounds(props.data);
  timelineViewport.value =
    timelineViewport.value === null
      ? timelineViewportFromPreset(props.data, 30)
      : clampTimelineViewport(timelineViewport.value, physical);
}

function timelineWheelGestureAxis(event: WheelLikeEvent): 'horizontal' | 'vertical' | null {
  if (wheelGesture.value?.timeoutId !== undefined) {
    clearTimeout(wheelGesture.value.timeoutId);
  }
  const gesture = wheelGesture.value ?? {
    axis: null,
    deltaX: 0,
    deltaY: 0,
    timeoutId: undefined
  };
  gesture.deltaX += event.deltaX;
  gesture.deltaY += event.deltaY;
  const axis = gesture.axis ?? dominantTimelineWheelAxis(gesture.deltaX, gesture.deltaY);
  wheelGesture.value = {
    axis,
    deltaX: gesture.deltaX,
    deltaY: gesture.deltaY,
    timeoutId: setTimeout(() => {
      wheelGesture.value = null;
    }, TIMELINE_WHEEL_GESTURE_IDLE_MS)
  };
  return axis;
}

function updateTimelineSelection(startX: number, currentX: number): void {
  selectionBox.left = Math.min(startX, currentX);
  selectionBox.width = Math.abs(currentX - startX);
  selectionBox.active = true;
}

function cancelTimelineSelection(pointerId: number): void {
  if (selection.value?.pointerId === pointerId) {
    selection.value = null;
  }
  selectionBox.active = false;
  selectionBox.width = 0;
  track.value?.releasePointerCapture?.(pointerId);
}

function wheelEvent(event: Event): WheelLikeEvent {
  return event as unknown as WheelLikeEvent;
}

function zoomTimelineViewport(event: WheelLikeEvent): void {
  const model = view.value;
  const currentTrack = track.value;
  if (!model || !currentTrack) return;
  event.preventDefault();
  const rect = currentTrack.getBoundingClientRect();
  if (rect.width <= 0) return;
  const physical = timelinePhysicalBounds(props.data);
  const startAt = model.min.getTime();
  const endAt = model.max.getTime();
  const span = endAt - startAt;
  const pointerRatio = clamp((event.clientX - rect.left) / rect.width, 0, 1);
  const anchorAt = startAt + span * pointerRatio;
  const zoomFactor = Math.exp(event.deltaY * 0.002);
  const nextSpan = clamp(
    span * zoomFactor,
    TIMELINE_MIN_WINDOW_MS,
    physical.endAt - physical.startAt
  );
  emit('freeformScale');
  timelineViewport.value = clampTimelineViewport(
    {
      endAt: anchorAt + nextSpan * (1 - pointerRatio),
      startAt: anchorAt - nextSpan * pointerRatio
    },
    physical
  );
}
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
      <div
        ref="track"
        class="relative h-12 min-w-0 flex-1 touch-none select-none overflow-hidden rounded-lg border border-zinc-200 bg-zinc-100"
        @click.capture="onTrackClickCapture"
        @pointercancel="onTrackPointerCancel"
        @pointerdown="onTrackPointerDown"
        @pointerleave="onTrackPointerLeave"
        @pointermove="onTrackPointerMove"
        @pointerup="onTrackPointerUp"
        @wheel="onTrackWheel"
      >
        <template v-for="segment in view.segments" :key="segment.key">
          <button
            v-if="segment.kind === 'gap'"
            class="coverage-gap"
            :aria-label="segment.ariaLabel"
            :data-gap-end="segment.endIso"
            :data-gap-start="segment.startIso"
            :style="segmentStyle(segment)"
            type="button"
            @click.stop.prevent="emit('addTarget', segment.startIso, segment.endIso)"
            @pointerdown="gapPointerDown(segment, $event)"
          ></button>
          <div
            v-else
            :aria-label="'ariaLabel' in segment ? segment.ariaLabel : undefined"
            :class="segmentClass(segment)"
            :style="segmentStyle(segment)"
            :tabindex="'hover' in segment ? 0 : undefined"
            @blur="clearHover"
            @focus="onSegmentFocus(segment, $event)"
            @pointerenter="'hover' in segment ? highlightItems([segment.hover]) : undefined"
            @pointerleave="'hover' in segment ? clearHighlight() : undefined"
          ></div>
        </template>
        <div
          class="timeline-selection"
          :class="{ 'is-active': selectionBox.active }"
          :style="selectionStyle"
        ></div>
      </div>
    </div>

    <div class="flex justify-between pl-8 text-xs text-zinc-500">
      <span
        v-for="label in view.dateLabels"
        :key="label.key"
        class="inline-block cursor-default tabular-nums"
        :class="label.align === 'right' ? 'text-right' : 'text-left'"
        :style="{ width: `${String(label.widthCh)}ch` }"
        @pointerenter="dateDeltaKey = label.key"
        @pointerleave="dateDeltaKey = null"
      >
        {{ dateDeltaKey === label.key ? label.delta : label.label }}
      </span>
    </div>

    <div
      v-if="view.detailsEmpty"
      class="mt-3 rounded-lg border border-dashed border-zinc-300 p-4 text-center text-xs text-zinc-500"
    >
      No history items in the current scale.
    </div>

    <div v-else-if="coverageTableOpen" class="mt-3 grid gap-3">
      <section v-for="section in view.detailSections" :key="section.type" class="grid gap-1">
        <div class="text-xs font-semibold text-zinc-500">{{ section.title }}</div>
        <div class="overflow-hidden rounded-lg border border-zinc-200">
          <table class="w-full border-collapse text-left text-xs">
            <thead class="bg-zinc-50 text-zinc-500">
              <tr v-if="section.type === 'target'">
                <th class="px-3 py-2 font-semibold">Start</th>
                <th class="px-3 py-2 font-semibold">End</th>
                <th class="px-3 py-2 font-semibold">Duration</th>
                <th class="px-3 py-2 font-semibold">Template</th>
                <th class="px-3 py-2 font-semibold">Target id</th>
                <th class="w-20 px-3 py-2"></th>
              </tr>
              <tr v-else-if="section.type === 'job'">
                <th class="px-3 py-2 font-semibold">Start</th>
                <th class="px-3 py-2 font-semibold">End</th>
                <th class="px-3 py-2 font-semibold">Duration</th>
                <th class="px-3 py-2 font-semibold">Status</th>
                <th class="px-3 py-2 font-semibold">id</th>
                <th class="px-3 py-2 font-semibold">cursor</th>
              </tr>
              <tr v-else>
                <th class="px-3 py-2 font-semibold">Start</th>
                <th class="px-3 py-2 font-semibold">End</th>
                <th class="px-3 py-2 font-semibold">Duration</th>
                <th class="px-3 py-2 font-semibold">Messages</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-zinc-100 bg-white">
              <tr
                v-for="detail in section.items"
                :key="detail.key"
                tabindex="0"
                :class="[
                  'timeline-table-row',
                  detail.type === 'coverage' ? 'coverage-table-row' : '',
                  isHighlighted(detail.key) ? 'timeline-linked-hover coverage-linked-hover' : ''
                ]"
                @blur="clearHover"
                @focus="onDetailFocus(detail, $event)"
                @pointerenter="highlightItems([detailHoverItem(detail)])"
                @pointerleave="clearHighlight"
              >
                <td class="px-3 py-2 font-mono text-zinc-700">
                  <div>{{ detail.startValue }}</div>
                  <div v-if="detail.startNote" class="mt-0.5 text-[11px] text-zinc-400">
                    {{ detail.startNote }}
                  </div>
                </td>
                <td class="px-3 py-2 font-mono text-zinc-700">
                  <div>{{ detail.endValue }}</div>
                  <div v-if="detail.endNote" class="mt-0.5 text-[11px] text-zinc-400">
                    {{ detail.endNote }}
                  </div>
                </td>
                <td class="px-3 py-2 text-zinc-500">{{ detail.duration }}</td>

                <template v-if="detail.type === 'target'">
                  <td class="px-3 py-2 text-zinc-600">{{ detail.templateId }}</td>
                  <td class="px-3 py-2">
                    <code class="break-all text-zinc-500">{{ detail.id }}</code>
                  </td>
                  <td class="px-3 py-1 text-right">
                    <button
                      v-if="detail.id"
                      type="button"
                      class="rounded-md border border-red-200 bg-red-50 px-2 py-0.5 text-xs font-medium leading-5 text-red-700 hover:bg-red-100"
                      @click="emit('deleteTarget', detail.id)"
                    >
                      Delete
                    </button>
                  </td>
                </template>

                <template v-else-if="detail.type === 'job'">
                  <td class="px-3 py-2 text-zinc-600">{{ detail.status }}</td>
                  <td class="px-3 py-2">
                    <code class="break-all text-zinc-500">{{ detail.id }}</code>
                  </td>
                  <td class="px-3 py-2">
                    <code v-if="detail.cursor">yes</code>
                  </td>
                </template>

                <template v-else>
                  <td class="px-3 py-2 text-zinc-500">{{ detail.count }}</td>
                </template>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>

    <div
      v-if="hoverItems.length > 0"
      ref="hoverPanel"
      class="app-hover-stack"
      :style="{ transform: hoverTransform }"
    >
      <div v-for="item in hoverItems" :key="`${item.kind}:${item.key}`" class="app-hover-popover">
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
  </div>
</template>
