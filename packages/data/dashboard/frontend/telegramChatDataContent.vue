<script setup lang="ts">
import type { SlotContext } from '@agentg/framework/dashboard';
import { computed, ref, shallowRef, watch } from 'vue';

import { annotationId, collectionItemId } from '../../src/ids.js';
import type { AnnotationRecord, CollectionRecord, ModelRef, Overview } from '../contracts.js';
import { useDashboardApi } from './api.js';
import DataGrid from './dataGrid.vue';
import DataInspector from './dataInspector.vue';
import type { DataGridColumn, DataGridRow, InspectorView, SortState } from './viewTypes.js';

type SummarySection = Readonly<{
  columns: readonly DataGridColumn[];
  hasMore: boolean;
  id: string;
  label: string;
  rows: readonly DataGridRow[];
  totalRows: number | null;
}>;

const props = defineProps<{
  slotContext?: SlotContext | undefined;
}>();

const SUMMARY_PAGE_SIZE = 25;
const CHAT_MODEL = 'telegram.chat';

const summaryAnnotationTableColumns = [
  { key: 'key', label: 'Key' },
  { key: 'value', label: 'Value' },
  { key: 'updatedAt', label: 'Updated' }
] as const satisfies readonly DataGridColumn[];

const summaryCollectionTableColumns = [
  { key: 'key', label: 'Key' },
  { key: 'itemId', label: 'Item ID' },
  { key: 'value', label: 'Value' },
  { key: 'updatedAt', label: 'Updated' }
] as const satisfies readonly DataGridColumn[];

const api = useDashboardApi();
const selectedChatId = computed(() => {
  const value = props.slotContext?.selectedChatId;
  return typeof value === 'string' && value.trim().length > 0 ? value : null;
});
const selectedSubject = computed<ModelRef | null>(() =>
  selectedChatId.value === null ? null : { _model: CHAT_MODEL, id: selectedChatId.value }
);

const sections = shallowRef<readonly SummarySection[]>([]);
const activeSectionId = ref<string | null>(null);
const selectedRowId = ref<string | null>(null);
const summarySorts = ref<Record<string, SortState>>({});
const busy = ref(false);
const loadError = ref<string | null>(null);
let loadSequence = 0;

const activeSection = computed(() => {
  const selectedId = activeSectionId.value;
  return sections.value.find((section) => section.id === selectedId) ?? sections.value[0] ?? null;
});
const inspectorView = computed<InspectorView | null>(() => {
  const section = activeSection.value;
  if (section === null || selectedRowId.value === null) {
    return null;
  }
  return sectionRows(section).find((row) => row.id === selectedRowId.value)?.inspectorView ?? null;
});

watch(
  selectedChatId,
  () => {
    void loadRelatedData();
  },
  { immediate: true }
);

async function loadRelatedData(): Promise<void> {
  const subject = selectedSubject.value;
  const sequence = ++loadSequence;
  sections.value = [];
  activeSectionId.value = null;
  selectedRowId.value = null;
  loadError.value = null;
  if (subject === null) {
    busy.value = false;
    return;
  }
  busy.value = true;
  try {
    const overview = await api.overview();
    const nextSections = await loadSummarySections(subject, collectionKeys(overview));
    if (sequence !== loadSequence) {
      return;
    }
    sections.value = nextSections;
    activeSectionId.value = nextSections[0]?.id ?? null;
  } catch (error) {
    if (sequence === loadSequence) {
      loadError.value = errorMessage(error);
    }
  } finally {
    if (sequence === loadSequence) {
      busy.value = false;
    }
  }
}

async function loadSummarySections(
  subject: ModelRef,
  keys: readonly string[]
): Promise<readonly SummarySection[]> {
  const nextSections: SummarySection[] = [];
  const annotationsPage = await api.browseAnnotations({
    limit: SUMMARY_PAGE_SIZE,
    offset: 0,
    subject
  });
  if ((annotationsPage.total ?? annotationsPage.rows.length) > 0) {
    nextSections.push({
      columns: summaryAnnotationTableColumns,
      hasMore: annotationsPage.hasMore,
      id: 'annotations',
      label: 'Annotations',
      rows: annotationsPage.rows.map((record) => annotationRow(record)),
      totalRows: annotationsPage.total ?? annotationsPage.rows.length
    });
  }

  for (const key of keys) {
    const page = await api.browseCollection({
      key,
      limit: SUMMARY_PAGE_SIZE,
      offset: 0,
      subject
    });
    if ((page.total ?? page.rows.length) > 0) {
      nextSections.push({
        columns: summaryCollectionTableColumns,
        hasMore: page.hasMore,
        id: `collection:${key}`,
        label: `Collection: ${key}`,
        rows: page.rows.map((record) => collectionRow(record)),
        totalRows: page.total ?? page.rows.length
      });
    }
  }

  return nextSections;
}

function collectionKeys(overview: Overview): readonly string[] {
  return overview.derivedStorage.collectionItems.byKey.map((item) => item.key);
}

function selectSection(sectionId: string): void {
  activeSectionId.value = sectionId;
  selectedRowId.value = null;
}

function selectRow(rowId: string): void {
  selectedRowId.value = rowId;
}

function closeInspector(): void {
  selectedRowId.value = null;
}

function changeSummarySort(section: SummarySection, value: SortState): void {
  summarySorts.value = {
    ...summarySorts.value,
    [section.id]: value
  };
}

function sectionRows(section: SummarySection): readonly DataGridRow[] {
  return sortRowsBy(section.rows, summarySorts.value[section.id] ?? null);
}

function summaryCountLabel(section: SummarySection): string {
  if (section.totalRows === null) {
    return section.hasMore ? `${String(section.rows.length)}+` : String(section.rows.length);
  }
  const total = section.totalRows ?? section.rows.length;
  return total > section.rows.length
    ? `${String(section.rows.length)} / ${String(total)}`
    : String(total);
}

function annotationRow(record: AnnotationRecord): DataGridRow {
  const value = preview(record.value);
  return {
    cells: {
      key: record.key,
      updatedAt: formatDate(record.updatedAt),
      value
    },
    clientChatId: clientChatId(record.subject) ?? undefined,
    filterValues: {
      key: record.key,
      updatedAt: record.updatedAt,
      value: rawJsonValue(record.value)
    },
    id: annotationRef(record).id,
    inspectorView: annotationView(record),
    sortValues: {
      key: record.key,
      updatedAt: Date.parse(record.updatedAt),
      value
    }
  };
}

function collectionRow(record: CollectionRecord): DataGridRow {
  const value = preview(record.value);
  return {
    cells: {
      itemId: record.itemId,
      key: record.key,
      updatedAt: formatDate(record.updatedAt),
      value
    },
    clientChatId: clientChatId(record.subject) ?? undefined,
    filterValues: {
      itemId: record.itemId,
      key: record.key,
      updatedAt: record.updatedAt,
      value: rawJsonValue(record.value)
    },
    id: collectionRef(record).id,
    inspectorView: collectionView(record),
    sortValues: {
      itemId: record.itemId,
      key: record.key,
      updatedAt: Date.parse(record.updatedAt),
      value
    }
  };
}

function annotationView(record: AnnotationRecord): InspectorView {
  return {
    actions: [{ href: clientPathForChat(record.subject.id), label: 'Open in client' }],
    fields: [
      { label: 'Subject', value: refLabel(record.subject) },
      { label: 'Key', value: record.key },
      { label: 'Updated', value: formatDate(record.updatedAt) },
      { label: 'Value', value: preview(record.value) }
    ],
    title: 'Annotation'
  };
}

function collectionView(record: CollectionRecord): InspectorView {
  return {
    actions: [{ href: clientPathForChat(record.subject.id), label: 'Open in client' }],
    fields: [
      { label: 'Subject', value: refLabel(record.subject) },
      { label: 'Key', value: record.key },
      { label: 'Item ID', value: record.itemId },
      { label: 'Updated', value: formatDate(record.updatedAt) },
      { label: 'Value', value: preview(record.value) }
    ],
    title: 'Collection item'
  };
}

function sortRowsBy(rows: readonly DataGridRow[], state: SortState | null): readonly DataGridRow[] {
  if (state === null) {
    return rows;
  }
  const direction = state.direction === 'asc' ? 1 : -1;
  return [...rows].sort(
    (left, right) =>
      compareValues(sortValue(left, state.key), sortValue(right, state.key)) * direction ||
      left.id.localeCompare(right.id)
  );
}

function sortValue(row: DataGridRow, key: string): number | string {
  return row.sortValues?.[key] ?? row.cells[key] ?? '';
}

function compareValues(left: number | string, right: number | string): number {
  if (typeof left === 'number' && typeof right === 'number') {
    return left - right;
  }
  return String(left).localeCompare(String(right), undefined, {
    numeric: true,
    sensitivity: 'base'
  });
}

function annotationRef(record: AnnotationRecord): ModelRef {
  return {
    _model: 'data.annotation',
    id: annotationId({
      key: record.key,
      subjectId: record.subject.id,
      subjectModel: record.subject._model
    })
  };
}

function collectionRef(record: CollectionRecord): ModelRef {
  return {
    _model: 'data.collectionItem',
    id: collectionItemId({
      itemId: record.itemId,
      key: record.key,
      subjectId: record.subject.id,
      subjectModel: record.subject._model
    })
  };
}

function clientChatId(ref: ModelRef): string | null {
  return ref._model === CHAT_MODEL && ref.id.trim().length > 0 ? ref.id : null;
}

function clientPathForChat(chatId: string): string {
  return `/client/chats/${encodeURIComponent(chatId)}`;
}

function openClientChat(chatId: string): void {
  window.location.assign(clientPathForChat(chatId));
}

function openHref(href: string): void {
  window.location.assign(href);
}

function ignoreFilter(): void {
  return;
}

function preview(value: unknown): string {
  const text = JSON.stringify(value);
  if (text === undefined) {
    return '';
  }
  return text.length > 180 ? `${text.slice(0, 177)}...` : text;
}

function rawJsonValue(value: unknown): string {
  return JSON.stringify(value) ?? '';
}

function formatDate(value: string): string {
  return new Date(value).toLocaleString();
}

function refLabel(ref: ModelRef): string {
  return `${ref._model}:${ref.id}`;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
</script>

<template>
  <section class="telegram-chat-data-content" aria-label="Data">
    <div v-if="selectedChatId === null" class="telegram-chat-data-content__state">
      No chat selected
    </div>

    <div v-else-if="busy" class="telegram-chat-data-content__state">Loading data</div>

    <div v-else-if="loadError !== null" class="telegram-chat-data-content__state">
      {{ loadError }}
    </div>

    <div v-else-if="sections.length === 0" class="telegram-chat-data-content__state">
      No related data
    </div>

    <div v-else class="telegram-chat-data-content__layout">
      <main class="telegram-chat-data-content__main">
        <div v-if="sections.length > 1" class="telegram-chat-data-content__tabs" role="tablist">
          <button
            v-for="section in sections"
            :key="section.id"
            type="button"
            class="telegram-chat-data-content__tab"
            :aria-selected="activeSection?.id === section.id"
            :data-active="activeSection?.id === section.id ? 'true' : undefined"
            role="tab"
            @click="selectSection(section.id)"
          >
            <span class="telegram-chat-data-content__tab-label">{{ section.label }}</span>
            <span class="telegram-chat-data-content__count">{{ summaryCountLabel(section) }}</span>
          </button>
        </div>

        <section
          v-if="activeSection !== null"
          class="telegram-chat-data-content__section"
          role="tabpanel"
        >
          <header class="telegram-chat-data-content__section-header">
            <h2 class="telegram-chat-data-content__title">{{ activeSection.label }}</h2>
            <span class="telegram-chat-data-content__count">
              {{ summaryCountLabel(activeSection) }}
            </span>
          </header>

          <DataGrid
            :busy="false"
            :columns="activeSection.columns"
            :empty-action-label="null"
            empty-label="No rows"
            :has-more="false"
            :page-offset="0"
            :page-size="SUMMARY_PAGE_SIZE"
            :rows="sectionRows(activeSection)"
            :selected-row-id="selectedRowId"
            :show-footer="false"
            :sort-state="summarySorts[activeSection.id] ?? null"
            :storage-key="`telegramChatData.${activeSection.id}`"
            :total-rows="activeSection.totalRows"
            @change-page="ignoreFilter"
            @change-page-size="ignoreFilter"
            @change-sort="changeSummarySort(activeSection, $event)"
            @clear-filter="ignoreFilter"
            @filter-cell="ignoreFilter"
            @go-to-subject="ignoreFilter"
            @open-client-chat="openClientChat"
            @select-row="selectRow"
          />
        </section>
      </main>

      <div v-if="inspectorView !== null" class="telegram-chat-data-content__inspector">
        <DataInspector
          :view="inspectorView"
          @close="closeInspector"
          @go-to-ref="ignoreFilter"
          @open-href="openHref"
          @open-related-data="ignoreFilter"
        />
      </div>
    </div>
  </section>
</template>

<style scoped>
@reference "tailwindcss";

.telegram-chat-data-content {
  @apply flex h-full min-h-0 w-full flex-col overflow-hidden bg-white text-sm text-zinc-950;
}

.telegram-chat-data-content__state {
  @apply flex h-full min-h-0 items-center justify-center p-8 text-sm text-zinc-500;
}

.telegram-chat-data-content__layout {
  @apply grid h-full min-h-0 grid-cols-1 overflow-hidden xl:grid-cols-[minmax(0,1fr)_22rem];
}

.telegram-chat-data-content__main {
  @apply flex min-h-0 flex-col overflow-hidden;
}

.telegram-chat-data-content__tabs {
  @apply flex shrink-0 gap-1 overflow-x-auto border-b border-zinc-200 bg-zinc-50 px-3 py-2;
}

.telegram-chat-data-content__tab {
  @apply flex h-8 shrink-0 items-center gap-2 border border-transparent bg-transparent px-3 text-xs font-semibold text-zinc-600 hover:border-zinc-300 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500;
}

.telegram-chat-data-content__tab[data-active='true'] {
  @apply border-teal-300 bg-white text-teal-900 shadow-sm;
}

.telegram-chat-data-content__tab-label {
  @apply truncate;
}

.telegram-chat-data-content__count {
  @apply shrink-0 text-xs font-medium text-zinc-400;
}

.telegram-chat-data-content__section {
  @apply flex min-h-0 flex-1 flex-col overflow-hidden;
}

.telegram-chat-data-content__section-header {
  @apply flex h-10 shrink-0 items-center gap-2 border-b border-zinc-200 px-4;
}

.telegram-chat-data-content__title {
  @apply truncate text-sm font-semibold text-zinc-900;
}

.telegram-chat-data-content__inspector {
  @apply min-h-0 overflow-hidden border-t border-zinc-200 xl:border-l xl:border-t-0;
}
</style>
