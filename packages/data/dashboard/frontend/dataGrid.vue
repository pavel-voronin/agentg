<script setup lang="ts">
import SolarAltArrowRightBold from '~icons/solar/alt-arrow-right-bold';
import { computed, onBeforeUnmount, ref, watch } from 'vue';

import type { DataGridColumn, DataGridRow, SortState } from './viewTypes.js';

import type { ModelRef } from '../contracts.js';

const PAGE_SIZES = [25, 50, 100] as const;
const MIN_WIDTH = 80;
const MAX_WIDTH = 640;
const CHARACTER_WIDTH = 6.2;
const BODY_TEXT_FONT =
  '12px ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
const CELL_HORIZONTAL_SPACE = 22;
const HEADER_HORIZONTAL_SPACE = 30;
const HEADER_TEXT_FONT =
  '600 11px ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

const props = defineProps<{
  busy: boolean;
  columns: readonly DataGridColumn[];
  emptyActionLabel: string | null;
  emptyLabel: string;
  hasMore: boolean;
  pageOffset: number;
  pageSize: number;
  rows: readonly DataGridRow[];
  selectedRowId: string | null;
  showFooter: boolean;
  sortState: SortState | null;
  storageKey: string;
  totalRows: number | null;
}>();

const emit = defineEmits<{
  changePage: [value: { limit: number; offset: number }];
  changePageSize: [value: number];
  changeSort: [value: SortState];
  clearFilter: [];
  filterCell: [value: { key: string; operator: string; value: string }];
  goToSubject: [subject: ModelRef];
  openClientChat: [chatId: string];
  openRelatedData: [subject: ModelRef];
  selectRow: [rowId: string];
}>();

type ContextFilterAction = Readonly<{
  key: string;
  label: string;
  operator: string;
  value: string;
}>;

type ContextMenu = Readonly<{
  cellValue: string;
  clientChatId?: string | undefined;
  filterActions: readonly ContextFilterAction[];
  relatedDataRef?: ModelRef | undefined;
  subject?: ModelRef | undefined;
  subjectOpenable: boolean;
  x: number;
  y: number;
}>;

const userWidths = ref<Record<string, number>>(readWidths(props.storageKey));
const contextMenu = ref<ContextMenu | null>(null);
let canvasContext: CanvasRenderingContext2D | null | undefined;
let cleanupResize: (() => void) | null = null;

const pageStart = computed(() => props.pageOffset);
const pageEnd = computed(() => props.pageOffset + props.rows.length);
const visibleStart = computed(() => (props.rows.length === 0 ? 0 : pageStart.value + 1));
const tableWidth = computed(() =>
  props.columns.reduce((total, column) => total + columnWidth(column), 0)
);
const tableStyle = computed<Record<string, string>>(() => ({
  width: `${tableWidth.value}px`
}));
const contextMenuStyle = computed<Record<string, string>>(() => ({
  left: `${String(contextMenu.value?.x ?? 0)}px`,
  top: `${String(contextMenu.value?.y ?? 0)}px`
}));
const totalLabel = computed(() => {
  if (props.totalRows !== null) {
    return String(props.totalRows);
  }
  return props.hasMore ? `${String(pageEnd.value)}+` : String(pageEnd.value);
});

watch(
  () => props.storageKey,
  (key) => {
    userWidths.value = readWidths(key);
  }
);

onBeforeUnmount(() => {
  cleanupResize?.();
});

function previousPage(): void {
  closeContextMenu();
  emit('changePage', {
    limit: props.pageSize,
    offset: Math.max(0, props.pageOffset - props.pageSize)
  });
}

function nextPage(): void {
  closeContextMenu();
  emit('changePage', {
    limit: props.pageSize,
    offset: props.pageOffset + props.pageSize
  });
}

function setPageSize(event: Event): void {
  const value = Number((event.target as HTMLSelectElement).value);
  closeContextMenu();
  emit('changePageSize', PAGE_SIZES.includes(value as (typeof PAGE_SIZES)[number]) ? value : 25);
}

function columnWidth(column: DataGridColumn): number {
  return userWidths.value[column.key] ?? defaultWidth(column);
}

function columnStyle(column: DataGridColumn): Record<string, string> {
  return {
    width: `${columnWidth(column)}px`
  };
}

function startResize(column: DataGridColumn, event: PointerEvent): void {
  const startX = event.clientX;
  const startWidth = columnWidth(column);
  cleanupResize?.();

  const move = (moveEvent: PointerEvent) => {
    userWidths.value = {
      ...userWidths.value,
      [column.key]: clamp(startWidth + moveEvent.clientX - startX, MIN_WIDTH, MAX_WIDTH)
    };
  };
  const stop = () => {
    cleanupResize?.();
    cleanupResize = null;
    writeStorage(widthsKey(props.storageKey), JSON.stringify(userWidths.value));
  };

  cleanupResize = () => {
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', stop);
  };
  window.addEventListener('pointermove', move);
  window.addEventListener('pointerup', stop);
  event.preventDefault();
}

function autoSizeColumn(column: DataGridColumn, event: MouseEvent): void {
  event.preventDefault();
  event.stopPropagation();
  userWidths.value = {
    ...userWidths.value,
    [column.key]: defaultWidth(column)
  };
  writeStorage(widthsKey(props.storageKey), JSON.stringify(userWidths.value));
}

function toggleSort(column: DataGridColumn): void {
  closeContextMenu();
  if (!isSortable(column)) {
    return;
  }
  emit('changeSort', {
    direction:
      props.sortState?.key === column.key && props.sortState.direction === 'asc' ? 'desc' : 'asc',
    key: column.key
  });
}

function sortAria(column: DataGridColumn): 'ascending' | 'descending' | 'none' {
  if (!isSortable(column)) {
    return 'none';
  }
  if (props.sortState?.key !== column.key) {
    return 'none';
  }
  return props.sortState.direction === 'asc' ? 'ascending' : 'descending';
}

function sortTitle(column: DataGridColumn): string {
  if (!isSortable(column)) {
    return column.label;
  }
  if (props.sortState?.key === column.key && props.sortState.direction === 'asc') {
    return `Sort ${column.label} descending`;
  }
  return `Sort ${column.label} ascending`;
}

function isSortable(column: DataGridColumn): boolean {
  return column.sortable !== false;
}

function openContextMenu(row: DataGridRow, column: DataGridColumn, event: MouseEvent): void {
  const filterValue = row.filterValues?.[column.key] ?? row.cells[column.key] ?? '';
  contextMenu.value = {
    cellValue: row.cells[column.key] ?? '',
    clientChatId: row.clientChatId,
    filterActions: filterActions(column, filterValue),
    relatedDataRef: row.relatedDataRef,
    subject: row.subject,
    subjectOpenable: row.subjectOpenable === true,
    x: event.clientX,
    y: event.clientY
  };
  event.preventDefault();
  event.stopPropagation();
}

function closeContextMenu(): void {
  contextMenu.value = null;
}

function applyContextFilter(action: ContextFilterAction): void {
  emit('filterCell', {
    key: action.key,
    operator: action.operator,
    value: action.value
  });
  closeContextMenu();
}

function openContextSubject(): void {
  if (contextMenu.value?.subject === undefined || !contextMenu.value.subjectOpenable) {
    return;
  }
  emit('goToSubject', contextMenu.value.subject);
  closeContextMenu();
}

function openContextClientChat(): void {
  if (contextMenu.value?.clientChatId === undefined) {
    return;
  }
  emit('openClientChat', contextMenu.value.clientChatId);
  closeContextMenu();
}

function openContextRelatedData(): void {
  if (contextMenu.value?.relatedDataRef === undefined) {
    return;
  }
  emit('openRelatedData', contextMenu.value.relatedDataRef);
  closeContextMenu();
}

function copyContextCell(): void {
  const value = contextMenu.value?.cellValue;
  closeContextMenu();
  if (value !== undefined) {
    void navigator.clipboard.writeText(value);
  }
}

function openCellSubject(row: DataGridRow, event: MouseEvent): void {
  if (row.subject === undefined || row.subjectOpenable !== true) {
    return;
  }
  event.stopPropagation();
  emit('goToSubject', row.subject);
}

function refLabel(ref: ModelRef): string {
  return `${ref._model}:${ref.id}`;
}

function filterActions(column: DataGridColumn, value: string): readonly ContextFilterAction[] {
  const filter = column.filter;
  const trimmed = value.trim();
  if (filter === undefined || trimmed.length === 0) {
    return [];
  }
  return filter.operators.map((operator) => ({
    key: filter.key,
    label: `Filter ${filter.label} ${operator.label} ${shortValue(trimmed)}`,
    operator: operator.key,
    value: trimmed
  }));
}

function shortValue(value: string): string {
  return value.length > 40 ? `${value.slice(0, 37)}...` : value;
}

function defaultWidth(column: DataGridColumn): number {
  const headerWidth =
    measureTextWidth(column.label.toUpperCase(), HEADER_TEXT_FONT) + HEADER_HORIZONTAL_SPACE;
  const cellWidth = props.rows.reduce(
    (max, row) =>
      Math.max(
        max,
        measureTextWidth(row.cells[column.key] ?? '', BODY_TEXT_FONT) + CELL_HORIZONTAL_SPACE
      ),
    0
  );
  return clamp(
    Math.max(headerWidth, cellWidth),
    MIN_WIDTH,
    column.key === 'value' ? 520 : MAX_WIDTH
  );
}

function measureTextWidth(text: string, font: string): number {
  const context = measuringContext();
  if (context === null) {
    return text.length * CHARACTER_WIDTH;
  }
  context.font = font;
  return context.measureText(text).width;
}

function measuringContext(): CanvasRenderingContext2D | null {
  if (canvasContext !== undefined) {
    return canvasContext;
  }
  if (typeof document === 'undefined') {
    canvasContext = null;
    return canvasContext;
  }
  canvasContext = document.createElement('canvas').getContext('2d');
  return canvasContext;
}

function readWidths(key: string): Record<string, number> {
  try {
    const parsed = JSON.parse(readStorage(widthsKey(key)) ?? '{}') as Record<string, unknown>;
    return Object.fromEntries(
      Object.entries(parsed)
        .filter((entry): entry is [string, number] => typeof entry[1] === 'number')
        .map(([column, width]) => [column, clamp(width, MIN_WIDTH, MAX_WIDTH)])
    );
  } catch {
    return {};
  }
}

function readStorage(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    return;
  }
}

function widthsKey(key: string): string {
  return `agentg.data.grid.widths.${key}`;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.round(value)));
}
</script>

<template>
  <section class="data-grid" @click="closeContextMenu">
    <div class="data-grid__frame">
      <table class="data-grid__table" :style="tableStyle">
        <colgroup class="data-grid__columns">
          <col
            v-for="column in columns"
            :key="column.key"
            class="data-grid__column"
            :style="columnStyle(column)"
          />
        </colgroup>
        <thead class="data-grid__head">
          <tr class="data-grid__row">
            <th
              v-for="column in columns"
              :key="column.key"
              class="data-grid__heading"
              :aria-sort="sortAria(column)"
            >
              <button
                type="button"
                class="data-grid__sort"
                :title="sortTitle(column)"
                :disabled="!isSortable(column)"
                @click="toggleSort(column)"
              >
                <span class="data-grid__heading-label">{{ column.label }}</span>
                <SolarAltArrowRightBold
                  v-if="isSortable(column)"
                  class="data-grid__sort-icon"
                  :data-active="sortState?.key === column.key ? 'true' : undefined"
                  :data-direction="sortState?.direction"
                  aria-hidden="true"
                />
              </button>
              <button
                type="button"
                class="data-grid__resize"
                :aria-label="`Resize ${column.label}`"
                :title="`Double-click to fit ${column.label}`"
                @dblclick="autoSizeColumn(column, $event)"
                @pointerdown="startResize(column, $event)"
              />
            </th>
          </tr>
        </thead>
        <tbody class="data-grid__body">
          <tr
            v-for="row in rows"
            :key="row.id"
            class="data-grid__row"
            :data-row-id="row.id"
            :data-selected="selectedRowId === row.id"
            tabindex="0"
            @click="emit('selectRow', row.id)"
            @keydown.enter="emit('selectRow', row.id)"
          >
            <td
              v-for="column in columns"
              :key="column.key"
              class="data-grid__cell"
              @contextmenu="openContextMenu(row, column, $event)"
            >
              <button
                v-if="
                  column.key === 'subject' &&
                  row.subject !== undefined &&
                  row.subjectOpenable === true
                "
                type="button"
                class="data-grid__subject"
                :title="`Go to ${refLabel(row.subject)}`"
                @click="openCellSubject(row, $event)"
              >
                {{ row.cells[column.key] }}
              </button>
              <template v-else>{{ row.cells[column.key] }}</template>
            </td>
          </tr>
        </tbody>
      </table>

      <div
        v-if="contextMenu !== null"
        class="data-grid__menu"
        :style="contextMenuStyle"
        @click.stop
      >
        <button type="button" class="data-grid__menu-item" @click="copyContextCell">
          Copy value
        </button>
        <button
          v-for="action in contextMenu.filterActions"
          :key="`${action.key}:${action.operator}`"
          type="button"
          class="data-grid__menu-item"
          @click="applyContextFilter(action)"
        >
          {{ action.label }}
        </button>
        <button
          v-if="contextMenu.subjectOpenable"
          type="button"
          class="data-grid__menu-item"
          @click="openContextSubject"
        >
          Go to subject
        </button>
        <button
          v-if="contextMenu.clientChatId !== undefined"
          type="button"
          class="data-grid__menu-item"
          @click="openContextClientChat"
        >
          Open in client
        </button>
        <button
          v-if="contextMenu.relatedDataRef !== undefined"
          type="button"
          class="data-grid__menu-item"
          @click="openContextRelatedData"
        >
          Open related data
        </button>
      </div>

      <div v-if="busy" class="data-grid__empty">Loading</div>
      <div v-else-if="rows.length === 0" class="data-grid__empty">
        <span class="data-grid__empty-label">{{ emptyLabel }}</span>
        <button
          v-if="emptyActionLabel !== null"
          type="button"
          class="data-grid__empty-action"
          @click="emit('clearFilter')"
        >
          {{ emptyActionLabel }}
        </button>
      </div>
    </div>

    <footer v-if="showFooter" class="data-grid__footer">
      <span class="data-grid__range"> {{ visibleStart }}-{{ pageEnd }} / {{ totalLabel }} </span>
      <label class="data-grid__page-size">
        <span class="data-grid__page-label">Rows</span>
        <select class="data-grid__select" :value="pageSize" @change="setPageSize">
          <option v-for="size in PAGE_SIZES" :key="size" :value="size">{{ size }}</option>
        </select>
      </label>
      <button
        type="button"
        class="data-grid__pager"
        aria-label="Previous page"
        :disabled="pageOffset === 0 || busy"
        title="Previous page"
        @click="previousPage"
      >
        <SolarAltArrowRightBold
          class="data-grid__pager-icon"
          data-direction="previous"
          aria-hidden="true"
        />
      </button>
      <button
        type="button"
        class="data-grid__pager"
        aria-label="Next page"
        :disabled="!hasMore || busy"
        title="Next page"
        @click="nextPage"
      >
        <SolarAltArrowRightBold class="data-grid__pager-icon" aria-hidden="true" />
      </button>
    </footer>
  </section>
</template>

<style scoped>
@reference "tailwindcss";

.data-grid {
  @apply flex min-h-0 flex-1 flex-col overflow-hidden overscroll-none border-t border-zinc-200 bg-white;
}

.data-grid__frame {
  @apply min-h-0 flex-1 overflow-auto overscroll-none bg-white;
}

.data-grid__table {
  @apply table-fixed border-separate border-spacing-0 text-left text-xs;
}

.data-grid__head {
  @apply sticky top-0 z-10 bg-zinc-50 text-zinc-600;
}

.data-grid__row {
  @apply cursor-default align-middle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500;
}

.data-grid__row:hover .data-grid__cell {
  @apply bg-teal-50/50;
}

.data-grid__row[data-selected='true'] .data-grid__cell {
  @apply bg-teal-50 text-teal-950;
}

.data-grid__heading {
  @apply relative h-6 overflow-hidden border-b border-r border-zinc-200 p-0 align-middle font-semibold uppercase text-[11px] leading-6 text-zinc-500;
}

.data-grid__sort {
  @apply flex h-full w-full min-w-0 items-center gap-1 bg-transparent px-2 text-left uppercase text-zinc-500 hover:bg-zinc-100 hover:text-zinc-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-teal-500;
}

.data-grid__sort:disabled {
  @apply cursor-default hover:bg-transparent hover:text-zinc-500;
}

.data-grid__heading-label {
  @apply min-w-0 flex-1 truncate leading-6;
}

.data-grid__sort-icon {
  @apply h-3 w-3 shrink-0 rotate-90 text-zinc-300;
}

.data-grid__sort-icon[data-active='true'] {
  @apply text-teal-700;
}

.data-grid__sort-icon[data-active='true'][data-direction='desc'] {
  @apply -rotate-90;
}

.data-grid__resize {
  @apply absolute right-0 top-0 h-full w-1 cursor-col-resize border-r border-transparent hover:border-teal-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500;
}

.data-grid__cell {
  @apply h-6 overflow-hidden text-ellipsis whitespace-nowrap border-b border-r border-zinc-100 bg-white px-2 py-0 align-middle leading-6 text-zinc-700;
}

.data-grid__subject {
  @apply max-w-full truncate bg-transparent p-0 text-left font-mono text-[11px] leading-6 text-teal-700 hover:text-teal-950 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500;
}

.data-grid__menu {
  @apply fixed z-50 grid min-w-36 border border-zinc-200 bg-white py-1 text-xs shadow-lg;
}

.data-grid__menu-item {
  @apply px-3 py-1.5 text-left text-zinc-700 hover:bg-teal-50 hover:text-teal-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-teal-500;
}

.data-grid__empty {
  @apply flex min-h-24 items-center justify-center gap-2 border-t border-zinc-100 p-4 text-xs text-zinc-500;
}

.data-grid__empty-label {
  @apply min-w-0 truncate;
}

.data-grid__empty-action {
  @apply border border-zinc-300 bg-white px-2 py-1 text-xs font-semibold text-zinc-700 hover:border-teal-500 hover:text-teal-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500;
}

.data-grid__footer {
  @apply flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-zinc-200 bg-zinc-50 px-3 py-1.5 text-xs text-zinc-600;
}

.data-grid__range {
  @apply mr-auto font-mono text-[11px] text-zinc-500;
}

.data-grid__page-size {
  @apply flex items-center gap-1;
}

.data-grid__page-label {
  @apply text-zinc-500;
}

.data-grid__select {
  @apply h-7 rounded-md border border-zinc-300 bg-white px-2 text-xs text-zinc-800 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500;
}

.data-grid__pager {
  @apply inline-flex h-7 w-7 items-center justify-center rounded-md border border-zinc-300 bg-white text-zinc-700 shadow-sm hover:border-zinc-400 hover:text-zinc-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 disabled:cursor-default disabled:opacity-40;
}

.data-grid__pager-icon {
  @apply h-4 w-4;
}

.data-grid__pager-icon[data-direction='previous'] {
  @apply rotate-180;
}
</style>
