<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, shallowRef, watch, type CSSProperties } from 'vue';

import { useSlotRuntime } from './runtime.js';
import type { ContentDefinition, SlotDebugEntry, SlotResolution } from './types.js';

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

const ICON_SIZE = 16;
const ICON_STEP = 18;
const POPOVER_ESTIMATED_HEIGHT = 190;
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
    const rect = target.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) {
      return [];
    }
    return [
      {
        ...entry,
        area: rect.width * rect.height,
        rect: {
          height: rect.height,
          left: rect.left,
          top: rect.top,
          width: rect.width
        }
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

function frameClass(entry: SlotDebugRectEntry): string[] {
  return ['slot-debug-frame', entry.id === activeId.value ? 'slot-debug-frame--active' : ''];
}

function frameStyle(entry: SlotDebugRectEntry): CSSProperties {
  return {
    height: `${String(entry.rect.height)}px`,
    left: `${String(entry.rect.left)}px`,
    top: `${String(entry.rect.top)}px`,
    width: `${String(entry.rect.width)}px`
  };
}

function iconClass(icon: SlotDebugIcon): string[] {
  return [
    'slot-debug-icon',
    icon.id === activeId.value ? 'slot-debug-icon--active' : '',
    icon.groupSize > 1 ? 'slot-debug-icon--stacked' : ''
  ];
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

function contentForResolution(resolution: SlotResolution): ContentDefinition | null {
  if (resolution.kind === 'content' || resolution.kind === 'incompatible') {
    return resolution.content;
  }
  return null;
}

function contentLabel(resolution: SlotResolution): string {
  switch (resolution.kind) {
    case 'content':
      return resolution.content.contentId;
    case 'empty':
      return 'empty';
    case 'incompatible':
      return `${resolution.content.contentId} (incompatible)`;
    case 'missing-content':
      return `${resolution.contentId} (missing)`;
  }
}

function tagList(tags: readonly string[]): string {
  return tags.length > 0 ? tags.join(', ') : 'none';
}

function contentTagList(resolution: SlotResolution): string {
  return tagList(contentForResolution(resolution)?.tags ?? []);
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
      resizeObserver.observe(target);
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
        :class="frameClass(entry)"
        :style="frameStyle(entry)"
      ></div>

      <button
        v-for="icon in icons"
        :key="`icon-${icon.id}`"
        type="button"
        :aria-label="iconLabel(icon)"
        :aria-pressed="pinnedId === icon.id"
        :class="iconClass(icon)"
        :style="iconStyle(icon)"
        @click.stop="togglePinnedSlot(icon.id)"
        @focusin="showHoverSlot(icon.id)"
        @focusout="scheduleClearHover"
        @mouseenter="showHoverSlot(icon.id)"
        @mouseleave="scheduleClearHover"
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          stroke-width="1.8"
          stroke-linecap="round"
        >
          <circle cx="8" cy="8" r="6" />
          <path d="M8 7.5v3.25" />
          <path d="M8 5.15h.01" />
        </svg>
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
            <dd>{{ activeEntry.slotId }}</dd>
          </div>
          <div>
            <dt>Slot tags</dt>
            <dd>{{ tagList(activeEntry.tags) }}</dd>
          </div>
          <div>
            <dt>Content</dt>
            <dd>{{ contentLabel(activeEntry.resolution) }}</dd>
          </div>
          <div>
            <dt>Content tags</dt>
            <dd>{{ contentTagList(activeEntry.resolution) }}</dd>
          </div>
        </dl>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.slot-debug-layer {
  inset: 0;
  pointer-events: none;
  position: fixed;
  z-index: 2147483000;
}

.slot-debug-frame {
  border-radius: 2px;
  box-shadow: inset 0 0 0 1px rgba(220, 38, 38, 0.95);
  pointer-events: none;
  position: absolute;
}

.slot-debug-frame--active {
  box-shadow:
    inset 0 0 0 2px rgba(220, 38, 38, 1),
    0 0 0 2px rgba(254, 202, 202, 0.85);
}

.slot-debug-icon {
  align-items: center;
  background: #ffffff;
  border: 1px solid rgba(220, 38, 38, 0.95);
  border-radius: 999px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.18);
  color: #dc2626;
  cursor: help;
  display: inline-flex;
  height: 16px;
  justify-content: center;
  padding: 1px;
  pointer-events: auto;
  position: absolute;
  width: 16px;
}

.slot-debug-icon--stacked {
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.22);
}

.slot-debug-icon--active {
  background: #dc2626;
  color: #ffffff;
}

.slot-debug-icon svg {
  height: 12px;
  width: 12px;
}

.slot-debug-popover {
  background: rgba(127, 29, 29, 0.96);
  border: 1px solid rgba(254, 202, 202, 0.7);
  border-radius: 6px;
  box-shadow: 0 12px 30px rgba(0, 0, 0, 0.26);
  color: #ffffff;
  font:
    11px/1.35 ui-monospace,
    SFMono-Regular,
    Menlo,
    Monaco,
    Consolas,
    monospace;
  max-height: calc(100vh - 32px);
  max-width: min(360px, calc(100vw - 32px));
  overflow: auto;
  padding: 8px;
  pointer-events: auto;
  position: absolute;
  width: max-content;
}

.slot-debug-popover dl {
  display: grid;
  gap: 6px;
  margin: 0;
}

.slot-debug-popover div {
  display: grid;
  gap: 2px;
}

.slot-debug-popover dt {
  color: #fecaca;
  font-weight: 600;
}

.slot-debug-popover dd {
  margin: 0;
  max-width: 320px;
  overflow-wrap: anywhere;
}
</style>
