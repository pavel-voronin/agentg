<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, shallowRef, watch, type CSSProperties } from 'vue';
import SolarInfoCircleBold from '~icons/solar/info-circle-bold';
import SolarTagBold from '~icons/solar/tag-bold';

import { useSlotRuntime } from './runtime.js';
import type {
  SlotDebugEntry,
  SlotItemResolution,
  SlotRenderState,
  SlotResolution
} from './types.js';

type SlotDebugRect = {
  height: number;
  left: number;
  top: number;
  width: number;
};

type SlotDebugRectEntry = SlotDebugEntry & {
  area: number;
  rect: SlotDebugRect;
};

type SlotDebugIcon = {
  entry: SlotDebugRectEntry;
  groupIndex: number;
  groupSize: number;
  id: number;
  left: number;
  top: number;
};

type SlotDebugViewport = {
  height: number;
  width: number;
};

type SlotDebugIconGroup = {
  anchorX: number;
  anchorY: number;
  items: SlotDebugRectEntry[];
};

type SlotDebugContentItem = {
  key: string;
  label: string;
  tag: string | null;
};

const ICON_SIZE = 16;
const ICON_STEP = 18;
const POPOVER_ESTIMATED_HEIGHT = 230;
const POPOVER_MAX_WIDTH = 360;
const VIEWPORT_MARGIN = 16;

const runtime = useSlotRuntime();
const geometryVersion = shallowRef(0);
const hoveredId = shallowRef<number | null>(null);
const pinnedId = shallowRef<number | null>(null);
const viewport = shallowRef<SlotDebugViewport>({ height: 0, width: 0 });

let animationFrame = 0;
let hoverClearTimer: ReturnType<typeof setTimeout> | null = null;
let resizeObserver: ResizeObserver | null = null;

const visibleEntries = computed<SlotDebugRectEntry[]>(() => {
  geometryVersion.value;
  return runtime.debugEntries.value.flatMap((entry) => {
    const target = htmlElementFromTarget(entry.target);
    if (target === null) {
      return [];
    }
    const rect = debugRectForTarget(target);
    if (rect === null) {
      return [];
    }
    return [
      {
        ...entry,
        area: rect.width * rect.height,
        rect
      }
    ];
  });
});

const icons = computed<SlotDebugIcon[]>(() => {
  const groups: SlotDebugIconGroup[] = [];
  const sortedEntries = [...visibleEntries.value].sort(
    (left, right) =>
      left.rect.top - right.rect.top ||
      left.rect.left - right.rect.left ||
      left.area - right.area ||
      left.order - right.order
  );

  for (const entry of sortedEntries) {
    const anchorX = entry.rect.left + entry.rect.width - 4;
    const anchorY = entry.rect.top + 4;
    let group = groups.find(
      (candidate) =>
        Math.abs(candidate.anchorX - anchorX) < ICON_STEP &&
        Math.abs(candidate.anchorY - anchorY) < ICON_STEP
    );

    if (group === undefined) {
      group = { anchorX, anchorY, items: [] };
      groups.push(group);
    }
    group.items.push(entry);
  }

  return groups.flatMap((group) => {
    const groupItems = [...group.items].sort(
      (left, right) => left.area - right.area || left.order - right.order
    );
    const stackWidth = ICON_SIZE + ICON_STEP * (groupItems.length - 1);
    const direction = group.anchorX - stackWidth > VIEWPORT_MARGIN ? -1 : 1;

    return groupItems.map((entry, index) => {
      const rawLeft =
        direction === -1
          ? group.anchorX - ICON_SIZE - index * ICON_STEP
          : group.anchorX + index * ICON_STEP;
      return {
        entry,
        groupIndex: index,
        groupSize: groupItems.length,
        id: entry.id,
        left: clamp(rawLeft, VIEWPORT_MARGIN, viewport.value.width - ICON_SIZE - VIEWPORT_MARGIN),
        top: clamp(
          group.anchorY,
          VIEWPORT_MARGIN,
          viewport.value.height - ICON_SIZE - VIEWPORT_MARGIN
        )
      };
    });
  });
});

const activeId = computed(() => hoveredId.value ?? pinnedId.value);
const activeEntry = computed(
  () => visibleEntries.value.find((entry) => entry.id === activeId.value) ?? null
);
const activeIcon = computed(() => icons.value.find((icon) => icon.id === activeId.value) ?? null);
const popoverStyle = computed<CSSProperties>(() => {
  const icon = activeIcon.value;
  if (icon === null) {
    return {};
  }

  const width = Math.min(
    POPOVER_MAX_WIDTH,
    Math.max(220, viewport.value.width - VIEWPORT_MARGIN * 2)
  );
  const left = clamp(icon.left, VIEWPORT_MARGIN, viewport.value.width - width - VIEWPORT_MARGIN);
  let top = icon.top + ICON_SIZE + 6;
  if (top + POPOVER_ESTIMATED_HEIGHT > viewport.value.height - VIEWPORT_MARGIN) {
    top = Math.max(VIEWPORT_MARGIN, icon.top - POPOVER_ESTIMATED_HEIGHT - 6);
  }

  return {
    left: `${String(left)}px`,
    maxWidth: `${String(width)}px`,
    top: `${String(top)}px`
  };
});

watch(
  () => runtime.debugEntries.value,
  () => bindObservedTargets(),
  { flush: 'post', immediate: true }
);

watch(
  () => runtime.debugEnabled.value,
  (enabled) => {
    if (!enabled) {
      clearActiveSlot();
    }
    bindObservedTargets();
  },
  { immediate: true }
);

onMounted(() => {
  updateViewport();
  window.addEventListener('resize', handleViewportChange);
  window.addEventListener('scroll', scheduleGeometryRefresh, true);
  window.addEventListener('keydown', handleKeydown);
});

onBeforeUnmount(() => {
  clearHoverTimer();
  disconnectResizeObserver();
  if (animationFrame !== 0) {
    cancelAnimationFrame(animationFrame);
    animationFrame = 0;
  }
  window.removeEventListener('resize', handleViewportChange);
  window.removeEventListener('scroll', scheduleGeometryRefresh, true);
  window.removeEventListener('keydown', handleKeydown);
});

function frameStyle(entry: SlotDebugRectEntry): CSSProperties {
  return {
    height: `${String(entry.rect.height)}px`,
    left: `${String(entry.rect.left)}px`,
    top: `${String(entry.rect.top)}px`,
    width: `${String(entry.rect.width)}px`
  };
}

function iconLabel(icon: SlotDebugIcon): string {
  const stackLabel =
    icon.groupSize > 1 ? `, ${String(icon.groupIndex + 1)} of ${String(icon.groupSize)}` : '';
  return `Slot debug: ${icon.entry.slotId}${stackLabel}`;
}

function iconStyle(icon: SlotDebugIcon): CSSProperties {
  return {
    left: `${String(icon.left)}px`,
    top: `${String(icon.top)}px`
  };
}

function showHoverSlot(id: number): void {
  clearHoverTimer();
  hoveredId.value = id;
}

function scheduleClearHover(): void {
  clearHoverTimer();
  hoverClearTimer = setTimeout(() => {
    hoveredId.value = null;
    hoverClearTimer = null;
  }, 120);
}

function togglePinnedSlot(id: number): void {
  pinnedId.value = pinnedId.value === id ? null : id;
  hoveredId.value = id;
}

function clearActiveSlot(): void {
  hoveredId.value = null;
  pinnedId.value = null;
}

function contentItems(
  resolution: SlotResolution,
  slotTags: readonly string[]
): SlotDebugContentItem[] {
  switch (resolution.kind) {
    case 'empty':
      return [{ key: 'empty', label: 'empty', tag: null }];
    case 'contents': {
      const overflowLabel =
        resolution.overflowCount > 0
          ? [
              {
                key: 'overflow',
                label: `+${String(resolution.overflowCount)} hidden`,
                tag: null
              }
            ]
          : [];
      return [...resolution.items.map((item) => contentItem(item, slotTags)), ...overflowLabel];
    }
  }
}

function tagItems(tags: readonly string[]): readonly string[] {
  return tags.length > 0 ? tags : ['none'];
}

function stateError(state: SlotRenderState): string | null {
  if (state.kind === 'empty') {
    return null;
  }
  const errors = state.items.flatMap((item) =>
    item.kind === 'component-load-error' || item.kind === 'component-render-error'
      ? [`${item.contentId}: ${item.error}`]
      : []
  );
  return errors.length > 0 ? errors.join('\n') : null;
}

function stateLabel(state: SlotRenderState): string {
  if (state.kind === 'empty') {
    return 'empty';
  }
  const readyCount = state.items.filter((item) => item.kind === 'component-ready').length;
  const overflowLabel = state.overflowCount > 0 ? `, ${String(state.overflowCount)} hidden` : '';
  return `contents (${String(readyCount)}/${String(state.items.length)} ready${overflowLabel})`;
}

function contentItem(item: SlotItemResolution, slotTags: readonly string[]): SlotDebugContentItem {
  switch (item.kind) {
    case 'content': {
      return {
        key: `${String(item.index)}:${item.contentId}`,
        label: item.contentId,
        tag: matchingSlotTag(slotTags, item.content.tags)
      };
    }
    case 'incompatible':
      return {
        key: `${String(item.index)}:${item.contentId}`,
        label: item.contentId,
        tag: 'incompatible'
      };
    case 'missing-content':
      return {
        key: `${String(item.index)}:${item.contentId}`,
        label: item.contentId,
        tag: 'missing'
      };
  }
}

function matchingSlotTag(
  slotTags: readonly string[],
  contentTags: readonly string[]
): string | null {
  return slotTags.find((slotTag) => contentTags.includes(slotTag)) ?? null;
}

function bindObservedTargets(): void {
  disconnectResizeObserver();
  if (!runtime.debugEnabled.value || typeof ResizeObserver === 'undefined') {
    scheduleGeometryRefresh();
    return;
  }

  resizeObserver = new ResizeObserver(() => scheduleGeometryRefresh());
  for (const entry of runtime.debugEntries.value) {
    const target = htmlElementFromTarget(entry.target);
    if (target !== null) {
      for (const observedElement of observedDebugElements(target)) {
        resizeObserver.observe(observedElement);
      }
    }
  }
  scheduleGeometryRefresh();
}

function disconnectResizeObserver(): void {
  if (resizeObserver !== null) {
    resizeObserver.disconnect();
    resizeObserver = null;
  }
}

function handleViewportChange(): void {
  updateViewport();
  scheduleGeometryRefresh();
}

function updateViewport(): void {
  if (typeof window === 'undefined') {
    return;
  }
  viewport.value = {
    height: window.innerHeight,
    width: window.innerWidth
  };
}

function handleKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') {
    clearActiveSlot();
  }
}

function scheduleGeometryRefresh(): void {
  if (animationFrame !== 0) {
    return;
  }
  if (typeof requestAnimationFrame === 'undefined') {
    geometryVersion.value += 1;
    return;
  }
  animationFrame = requestAnimationFrame(() => {
    animationFrame = 0;
    updateViewport();
    geometryVersion.value += 1;
  });
}

function clearHoverTimer(): void {
  if (hoverClearTimer !== null) {
    clearTimeout(hoverClearTimer);
    hoverClearTimer = null;
  }
}

function htmlElementFromTarget(target: unknown): HTMLElement | null {
  return target instanceof HTMLElement ? target : null;
}

function debugRectForTarget(target: HTMLElement): SlotDebugRect | null {
  const selfRect = target.getBoundingClientRect();
  if (selfRect.width > 0 && selfRect.height > 0) {
    return slotDebugRectFromDomRect(selfRect);
  }

  const childRects = [...target.querySelectorAll<HTMLElement>('*')]
    .map((element) => element.getBoundingClientRect())
    .filter((rect) => rect.width > 0 && rect.height > 0);
  if (childRects.length === 0) {
    return null;
  }

  const left = Math.min(...childRects.map((rect) => rect.left));
  const top = Math.min(...childRects.map((rect) => rect.top));
  const right = Math.max(...childRects.map((rect) => rect.right));
  const bottom = Math.max(...childRects.map((rect) => rect.bottom));
  return {
    height: bottom - top,
    left,
    top,
    width: right - left
  };
}

function slotDebugRectFromDomRect(rect: DOMRect): SlotDebugRect {
  return {
    height: rect.height,
    left: rect.left,
    top: rect.top,
    width: rect.width
  };
}

function observedDebugElements(target: HTMLElement): HTMLElement[] {
  return [target, ...target.querySelectorAll<HTMLElement>('*')];
}

function clamp(value: number, min: number, max: number): number {
  if (max < min) {
    return min;
  }
  return Math.min(Math.max(value, min), max);
}
</script>

<template>
  <Teleport to="body">
    <div v-if="runtime.debugEnabled.value" class="slot-debug-layer">
      <div
        v-for="entry in visibleEntries"
        :key="`frame-${entry.id}`"
        class="slot-debug-frame"
        :data-active="entry.id === activeId ? 'true' : undefined"
        :style="frameStyle(entry)"
      ></div>

      <button
        v-for="icon in icons"
        :key="`icon-${icon.id}`"
        type="button"
        :aria-label="iconLabel(icon)"
        :aria-pressed="pinnedId === icon.id"
        class="slot-debug-icon"
        :data-active="icon.id === activeId ? 'true' : undefined"
        :data-stacked="icon.groupSize > 1 ? 'true' : undefined"
        :style="iconStyle(icon)"
        @click.stop="togglePinnedSlot(icon.id)"
        @focusin="showHoverSlot(icon.id)"
        @focusout="scheduleClearHover"
        @mouseenter="showHoverSlot(icon.id)"
        @mouseleave="scheduleClearHover"
      >
        <SolarInfoCircleBold class="slot-debug-icon__mark" aria-hidden="true" />
      </button>

      <div
        v-if="activeEntry"
        class="slot-debug-popover"
        :style="popoverStyle"
        @mouseenter="showHoverSlot(activeEntry.id)"
        @mouseleave="scheduleClearHover"
      >
        <dl>
          <div>
            <dt>Slot</dt>
            <dd>
              <span class="slot-debug-slot-label">{{ activeEntry.slotId }}</span>
              <span v-for="tag in tagItems(activeEntry.tags)" :key="tag" class="slot-debug-tag">
                <SolarTagBold aria-hidden="true" class="slot-debug-tag-icon" />
                <span class="slot-debug-tag-text">{{ tag }}</span>
              </span>
            </dd>
          </div>
          <div>
            <dt>State</dt>
            <dd>{{ stateLabel(activeEntry.state) }}</dd>
          </div>
          <div>
            <dt>Content</dt>
            <dd>
              <span
                v-for="item in contentItems(activeEntry.resolution, activeEntry.tags)"
                :key="item.key"
                class="slot-debug-content-item"
              >
                <span class="slot-debug-content-label">{{ item.label }}</span>
                <span v-if="item.tag" class="slot-debug-tag">
                  <SolarTagBold aria-hidden="true" class="slot-debug-tag-icon" />
                  <span class="slot-debug-tag-text">{{ item.tag }}</span>
                </span>
              </span>
            </dd>
          </div>
          <div v-if="stateError(activeEntry.state)">
            <dt>Error</dt>
            <dd>{{ stateError(activeEntry.state) }}</dd>
          </div>
        </dl>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
@reference "tailwindcss";
.slot-debug-layer {
  @apply pointer-events-none fixed inset-0 z-[2147483000];
}

.slot-debug-frame {
  @apply pointer-events-none absolute rounded-[2px] shadow-[inset_0_0_0_1px_rgba(220,38,38,0.95)];
}

.slot-debug-frame[data-active='true'] {
  @apply shadow-[inset_0_0_0_2px_rgb(220,38,38),0_0_0_2px_rgba(254,202,202,0.85)];
}

.slot-debug-icon {
  @apply pointer-events-auto absolute inline-flex h-4 w-4 cursor-help items-center justify-center rounded-full border border-red-600 bg-white p-px text-red-600 shadow-[0_1px_4px_rgba(0,0,0,0.18)];
}

.slot-debug-icon[data-stacked='true'] {
  @apply shadow-[0_1px_4px_rgba(0,0,0,0.22)];
}

.slot-debug-icon[data-active='true'] {
  @apply bg-red-600 text-white;
}

.slot-debug-icon svg {
  @apply h-3 w-3;
}

.slot-debug-popover {
  @apply pointer-events-auto absolute max-h-[calc(100vh-32px)] w-max max-w-[min(360px,calc(100vw-32px))] overflow-auto rounded-md border border-red-200/70 bg-red-900/95 p-2 font-mono text-[11px] leading-[1.35] text-white shadow-[0_12px_30px_rgba(0,0,0,0.26)];
}

.slot-debug-popover dl {
  @apply m-0 grid gap-1.5;
}

.slot-debug-popover div {
  @apply grid gap-0.5;
}

.slot-debug-popover dt {
  @apply font-semibold text-red-200;
}

.slot-debug-popover dd {
  @apply m-0 max-w-xs break-words;
}

.slot-debug-slot-label {
  @apply block;
}

.slot-debug-content-item {
  @apply block;
}

.slot-debug-content-item + .slot-debug-content-item {
  @apply mt-1.5;
}

.slot-debug-content-label {
  @apply block;
}

.slot-debug-tag {
  @apply mt-0.5 flex items-center gap-1 pl-2 text-[10px] leading-none text-red-200;
}

.slot-debug-tag-icon {
  @apply h-2.5 w-2.5 shrink-0;
}

.slot-debug-tag-text {
  @apply min-w-0 break-all;
}
</style>
