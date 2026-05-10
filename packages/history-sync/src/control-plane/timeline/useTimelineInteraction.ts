import { computed, nextTick, reactive, ref, watch, type Ref } from 'vue';

import type { SelectedHistorySyncState } from '../views.js';
import {
  TIMELINE_MIN_WINDOW_MS,
  TIMELINE_SELECTION_MIN_PX,
  TIMELINE_WHEEL_AXIS_DOMINANCE,
  TIMELINE_WHEEL_AXIS_INTENT_PX,
  TIMELINE_WHEEL_GESTURE_IDLE_MS,
  buildTimelineViewModel,
  clamp,
  clampTimelineViewport,
  historySyncItemsAtTime,
  timelineDetailHoverItem,
  timelinePhysicalBounds,
  timelineViewportFromPreset,
  type TimelineDetail,
  type TimelineHoverItem,
  type TimelineSegment,
  type TimelineViewport
} from './timelineModel.js';

export type TimelineHoverPanelElement = {
  offsetHeight: number;
  offsetWidth: number;
};

export type TimelineTrackElement = {
  getBoundingClientRect: () => Rect;
  releasePointerCapture?: (pointerId: number) => void;
  setPointerCapture?: (pointerId: number) => void;
};

type TimelineInteractionOptions = {
  data: Ref<SelectedHistorySyncState>;
  onAddTarget: (start: string, end: string) => void;
  onFreeformScale: () => void;
  viewportDays: Ref<number | null>;
};

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
  stopPropagation: () => void;
  target: unknown;
};

type Rect = {
  height: number;
  left: number;
  top: number;
  width: number;
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

type HoverPointer = {
  x: number;
  y: number;
};

type WheelGesture = {
  axis: 'horizontal' | 'vertical' | null;
  deltaX: number;
  deltaY: number;
  timeoutId: ReturnType<typeof setTimeout> | undefined;
};

const TIMELINE_COVERAGE_SELECTOR = '[data-kind="coverage"]';
const TIMELINE_GAP_SELECTOR = '[data-gap-start][data-gap-end]';

export function useTimelineInteraction(options: TimelineInteractionOptions) {
  const coverageTableOpen = ref(false);
  const highlightedKeys = ref<string[]>([]);
  const hoverItems = ref<TimelineHoverItem[]>([]);
  const hoverPanel = ref<TimelineHoverPanelElement | null>(null);
  const hoverPointer = ref<HoverPointer | null>(null);
  const hoverTransform = ref('translate(0px, 0px)');
  const selection = ref<TimelineSelection | null>(null);
  const suppressTimelineClick = ref(false);
  const activeChatId = ref<string | null>(null);
  const lastViewportDays = ref<number | null | undefined>(undefined);
  const timelineViewport = ref<TimelineViewport | null>(null);
  const track = ref<TimelineTrackElement | null>(null);
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
          data: options.data.value,
          viewport: timelineViewport.value
        })
  );

  const selectionStyle = computed(() => ({
    left: `${String(selectionBox.left)}px`,
    width: `${String(selectionBox.width)}px`
  }));

  watch(
    () => [options.data.value, options.viewportDays.value] as const,
    () => {
      const nextChatId = options.data.value.chat?.id ?? null;
      const chatChanged = activeChatId.value !== nextChatId;
      const scaleChanged = lastViewportDays.value !== options.viewportDays.value;
      if (chatChanged) {
        activeChatId.value = nextChatId;
        coverageTableOpen.value = false;
      }
      syncViewport({ resetToPreset: chatChanged || scaleChanged });
      lastViewportDays.value = options.viewportDays.value;
      if (chatChanged || scaleChanged) {
        clearHover();
        return;
      }
      refreshHover();
    },
    { immediate: true }
  );

  function clearHighlight(): void {
    highlightedKeys.value = [];
  }

  function clearHover(): void {
    hoverPointer.value = null;
    hoverItems.value = [];
    clearHighlight();
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
        options.onAddTarget(current.clickGapStart, current.clickGapEnd);
        suppressNextTimelineClick();
      }
      return;
    }
    suppressNextTimelineClick();
    const leftRatio = Math.min(current.startX, endX) / current.trackWidth;
    const rightRatio = Math.max(current.startX, endX) / current.trackWidth;
    const span = current.maxAt - current.minAt;
    const startAt = new Date(current.minAt + span * leftRatio);
    const endAt = new Date(current.minAt + span * rightRatio);
    options.onAddTarget(startAt.toISOString(), endAt.toISOString());
  }

  function highlightItems(items: TimelineHoverItem[]): void {
    highlightedKeys.value = items.map((item) => item.key);
  }

  function onDetailFocus(detail: TimelineDetail, event: Event): void {
    const item = timelineDetailHoverItem(detail);
    hoverItems.value = [item];
    highlightItems([item]);
    positionHoverFromEvent(event);
  }

  function onDetailHover(detail: TimelineDetail): void {
    highlightItems([timelineDetailHoverItem(detail)]);
  }

  function onSegmentFocus(segment: TimelineSegment, event: Event): void {
    if (!('hover' in segment)) return;
    hoverItems.value = [segment.hover];
    highlightItems([segment.hover]);
    positionHoverFromEvent(event);
  }

  function onSegmentHover(item: TimelineHoverItem): void {
    highlightItems([item]);
  }

  function onTrackClickCapture(event: Event): void {
    if (!suppressTimelineClick.value) return;
    event.preventDefault();
    event.stopPropagation();
    suppressTimelineClick.value = false;
  }

  function suppressNextTimelineClick(): void {
    suppressTimelineClick.value = true;
    setTimeout(() => {
      suppressTimelineClick.value = false;
    }, 250);
  }

  function onTrackPointerCancel(event: Event): void {
    cancelTimelineSelection(pointerEvent(event).pointerId);
  }

  function onTrackPointerDown(event: Event): void {
    const pointer = pointerEvent(event);
    if (pointer.button !== 0) return;
    if (!pointer.altKey && hasClosest(pointer.target, TIMELINE_COVERAGE_SELECTOR)) {
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
    const gapElement = gap?.closest?.(TIMELINE_GAP_SELECTOR) as {
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
    if (current?.pointerId === pointer.pointerId) {
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
    const items = historySyncItemsAtTime(options.data.value, model.min, model.max, at);
    if (items.length === 0) {
      clearHover();
      return;
    }
    hoverPointer.value = {
      x: pointer.clientX,
      y: pointer.clientY
    };
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
    const physical = timelinePhysicalBounds(options.data.value);
    options.onFreeformScale();
    timelineViewport.value = clampTimelineViewport(
      {
        endAt: model.max.getTime() + shift,
        startAt: model.min.getTime() + shift
      },
      physical
    );
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

  function refreshHover(): void {
    const pointer = hoverPointer.value;
    if (pointer === null) return;
    const items = hoverItemsAtPosition(pointer.x);
    if (items === null) return;
    if (items.length === 0) {
      clearHover();
      return;
    }
    hoverItems.value = items;
    highlightItems(items);
    positionHover(pointer.x, pointer.y);
  }

  function hoverItemsAtPosition(x: number): TimelineHoverItem[] | null {
    const model = view.value;
    const currentTrack = track.value;
    if (!model || !currentTrack) return null;
    const rect = currentTrack.getBoundingClientRect();
    if (rect.width <= 0) return null;
    const ratio = clamp((x - rect.left) / rect.width, 0, 1);
    const at = model.min.getTime() + (model.max.getTime() - model.min.getTime()) * ratio;
    return historySyncItemsAtTime(options.data.value, model.min, model.max, at);
  }

  function syncViewport(optionsForSync: { resetToPreset: boolean }): void {
    if (
      options.viewportDays.value !== null &&
      (optionsForSync.resetToPreset || timelineViewport.value === null)
    ) {
      timelineViewport.value = timelineViewportFromPreset(
        options.data.value,
        options.viewportDays.value
      );
      return;
    }
    const physical = timelinePhysicalBounds(options.data.value);
    timelineViewport.value =
      timelineViewport.value === null
        ? timelineViewportFromPreset(options.data.value, 30)
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

  function zoomTimelineViewport(event: WheelLikeEvent): void {
    const model = view.value;
    const currentTrack = track.value;
    if (!model || !currentTrack) return;
    event.preventDefault();
    const rect = currentTrack.getBoundingClientRect();
    if (rect.width <= 0) return;
    const physical = timelinePhysicalBounds(options.data.value);
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
    options.onFreeformScale();
    timelineViewport.value = clampTimelineViewport(
      {
        endAt: anchorAt + nextSpan * (1 - pointerRatio),
        startAt: anchorAt - nextSpan * pointerRatio
      },
      physical
    );
  }

  return {
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

function pointerEvent(event: Event): PointerLikeEvent {
  return event as unknown as PointerLikeEvent;
}

function wheelEvent(event: Event): WheelLikeEvent {
  return event as unknown as WheelLikeEvent;
}
