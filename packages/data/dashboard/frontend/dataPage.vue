<script setup lang="ts">
import { slotRoute, UiPage, type SlotContext } from '@agentg/framework/dashboard';
import SolarSettingsBold from '~icons/solar/settings-bold';
import { computed, onBeforeUnmount, onMounted, ref, shallowRef } from 'vue';

import { annotationId, collectionItemId } from '../../src/ids.js';
import {
  type AnnotationRecord,
  type CollectionRecord,
  type Dataset,
  type ModelRef,
  type Overview
} from '../contracts.js';
import { useDashboardApi } from './api.js';
import DataGrid from './dataGrid.vue';
import DataInspector from './dataInspector.vue';
import DataTree from './dataTree.vue';
import { isModelRouteSafeRef, isTelegramIntegerId } from './modelRefNavigation.js';
import type {
  DataGridColumn,
  DataGridRow,
  InspectorAction,
  InspectorView,
  Selection,
  SortState
} from './viewTypes.js';

type DatasetRow = Dataset['rows'][number];
type ModelEntry = Overview['catalog'][number];
type ModelColumn = ModelEntry['columns'][number];
type ModelFilterOperator = NonNullable<ModelColumn['filter']>['operators'][number];

type ActiveInspector = Readonly<{
  id: string;
  view: InspectorView;
}>;

type FilterDefinition = Readonly<{
  options: readonly ModelFilterOption[];
}>;

type ModelFilterOption = Readonly<{
  filter: NonNullable<ModelColumn['filter']>;
  key: string;
  label: string;
}>;

type ModelFilter = Readonly<{
  key: string;
  operator: string;
  value: string;
}>;

type ModelFilterMap = Readonly<Record<string, ModelFilter>>;

type SummaryMode = 'stack' | 'tabs';

type SummarySection = Readonly<{
  columns: readonly DataGridColumn[];
  hasMore: boolean;
  id: string;
  key: string;
  label: string;
  rows: readonly DataGridRow[];
  totalRows: number | null;
}>;

const props = defineProps<{
  slotContext?: SlotContext | undefined;
}>();

const PAGE_SIZE_KEY = 'agentg.data.grid.pageSize';
const PAGE_SIZES = [25, 50, 100] as const;
const SUMMARY_PAGE_SIZE = 25;
const TREE_WIDTH_KEY = 'agentg.data.page.treeWidth';
const INSPECTOR_WIDTH_KEY = 'agentg.data.page.inspectorWidth';
const TREE_WIDTH_DEFAULT = 320;
const TREE_WIDTH_MIN = 220;
const TREE_WIDTH_MAX = 520;
const INSPECTOR_WIDTH_DEFAULT = 448;
const INSPECTOR_WIDTH_MIN = 320;
const INSPECTOR_WIDTH_MAX = 680;

const api = useDashboardApi();
const route = computed(() => slotRoute(props.slotContext));

const overview = ref<Overview | null>(null);
const selection = ref<Selection | null>(null);
const inspector = shallowRef<ActiveInspector | null>(null);
const annotations = shallowRef<readonly AnnotationRecord[]>([]);
const collections = shallowRef<readonly CollectionRecord[]>([]);
const dataset = shallowRef<Dataset>({ rows: [] });
const summarySections = shallowRef<readonly SummarySection[]>([]);
const summaryMode = ref<SummaryMode>('tabs');
const activeSummaryId = ref<string | null>(null);
const summarySorts = ref<Record<string, SortState>>({});
const modelFilterDrafts = ref<ModelFilterMap>({});
const modelFilters = ref<ModelFilterMap>({});
const filtersVisible = ref(false);
const filterError = ref<string | null>(null);
const sortState = ref<SortState | null>(null);
const loadError = ref<string | null>(null);
const tableError = ref<string | null>(null);
const busy = ref(false);
const pageOffset = ref(0);
const pageSize = ref(readPageSize());
const pageHasMore = ref(false);
const totalRows = ref<number | null>(null);
const treeWidth = ref(
  readStoredWidth(TREE_WIDTH_KEY, TREE_WIDTH_DEFAULT, TREE_WIDTH_MIN, TREE_WIDTH_MAX)
);
const inspectorWidth = ref(
  readStoredWidth(
    INSPECTOR_WIDTH_KEY,
    INSPECTOR_WIDTH_DEFAULT,
    INSPECTOR_WIDTH_MIN,
    INSPECTOR_WIDTH_MAX
  )
);
let cleanupLayoutResize: (() => void) | null = null;

const selectableModels = computed(() =>
  (overview.value?.catalog ?? []).filter((entry) => entry.capabilities.includes('select'))
);

const providerGroups = computed(() => {
  const groups = new Map<string, ModelEntry[]>();
  for (const entry of selectableModels.value) {
    const items = groups.get(entry.provider) ?? [];
    items.push(entry);
    groups.set(entry.provider, items);
  }
  return [...groups.entries()]
    .map(([provider, models]) => ({
      models: [...models].sort((left, right) => left.model.localeCompare(right.model)),
      provider
    }))
    .sort((left, right) => left.provider.localeCompare(right.provider));
});

const annotationKeys = computed(() =>
  (overview.value?.derivedStorage.annotations.byKey ?? []).map((item) => item.key)
);
const collectionKeys = computed(() =>
  (overview.value?.derivedStorage.collectionItems.byKey ?? []).map((item) => item.key)
);

const annotationTableColumns = [
  { key: 'subject', label: 'Subject' },
  { key: 'value', label: 'Value' },
  { key: 'updatedAt', label: 'Updated' }
] as const satisfies readonly DataGridColumn[];

const collectionTableColumns = [
  { key: 'subject', label: 'Subject' },
  { key: 'itemId', label: 'Item ID' },
  { key: 'value', label: 'Value' },
  { key: 'updatedAt', label: 'Updated' }
] as const satisfies readonly DataGridColumn[];

const annotationFilterOptions = [
  {
    filter: {
      input: 'text',
      kind: 'where',
      operators: [
        { key: 'contains', label: 'contains', value: 'single', whereKey: 'subjectQuery' },
        {
          key: 'notContains',
          label: 'not contains',
          value: 'single',
          whereKey: 'subjectNotQuery'
        }
      ],
      placeholder: 'telegram.chat:-1001449711572'
    },
    key: 'subjectQuery',
    label: 'Subject'
  },
  {
    filter: {
      input: 'text',
      kind: 'where',
      operators: [
        { key: 'contains', label: 'contains', value: 'single', whereKey: 'valueQuery' },
        {
          key: 'notContains',
          label: 'not contains',
          value: 'single',
          whereKey: 'valueNotQuery'
        }
      ],
      placeholder: 'daily *summary'
    },
    key: 'valueQuery',
    label: 'Value'
  },
  {
    filter: {
      input: 'dateTime',
      kind: 'where',
      operators: [
        { key: 'gte', label: '>=', value: 'single', whereKey: 'updatedAtGte' },
        { key: 'gt', label: '>', value: 'single', whereKey: 'updatedAtGt' },
        { key: 'lte', label: '<=', value: 'single', whereKey: 'updatedAtLte' },
        { key: 'lt', label: '<', value: 'single', whereKey: 'updatedAtLt' }
      ],
      placeholder: '2026-01-01T00:00:00.000Z'
    },
    key: 'updatedAt',
    label: 'Updated'
  }
] as const satisfies readonly ModelFilterOption[];

const collectionFilterOptions = [
  ...annotationFilterOptions,
  {
    filter: {
      input: 'text',
      kind: 'where',
      operators: [
        { key: 'contains', label: 'contains', value: 'single', whereKey: 'itemIdQuery' },
        {
          key: 'notContains',
          label: 'not contains',
          value: 'single',
          whereKey: 'itemIdNotQuery'
        }
      ],
      placeholder: 'item_*'
    },
    key: 'itemIdQuery',
    label: 'Item ID'
  }
] as const satisfies readonly ModelFilterOption[];

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

const fallbackModelColumns = [
  { key: 'primaryRef', label: 'Primary Ref', source: { kind: 'primaryRef' } },
  { key: 'value', label: 'Value', source: { kind: 'valuePath', path: [] }, sortable: false }
] as const satisfies readonly ModelColumn[];

const tableTitle = computed(() => {
  if (selection.value === null) {
    return 'Data';
  }
  if (selection.value.kind === 'annotation') {
    return selection.value.key;
  }
  if (selection.value.kind === 'collection') {
    return selection.value.key;
  }
  if (selection.value.kind === 'relatedData') {
    return `${refLabel(selection.value.subject)} related data`;
  }
  return selection.value.model;
});

const emptyLabel = 'No rows';
const filterDefinition = computed<FilterDefinition | null>(() => {
  const options = filterOptionsForSelection(selection.value);
  if (options.length === 0) {
    return null;
  }
  return { options };
});
const filtersToggleTitle = computed(() => (filtersVisible.value ? 'Hide filters' : 'Show filters'));
const canClearFilter = computed(
  () =>
    Object.keys(modelFilters.value).length > 0 ||
    Object.values(modelFilterDrafts.value).some((filter) => filter.value.trim().length > 0)
);
const hasActiveFilter = computed(() => Object.keys(modelFilters.value).length > 0);
const visibleSummarySections = computed(() => {
  if (summaryMode.value === 'stack') {
    return summarySections.value;
  }
  const section = findSummarySection();
  return section === null ? [] : [section];
});

const tableColumns = computed<readonly DataGridColumn[]>(() => {
  const current = selection.value;
  if (current?.kind === 'annotation') {
    return columnsWithFilters(annotationTableColumns, annotationFilterOptions, {
      subject: 'subjectQuery',
      updatedAt: 'updatedAt',
      value: 'valueQuery'
    });
  }
  if (current?.kind === 'collection') {
    return columnsWithFilters(collectionTableColumns, collectionFilterOptions, {
      itemId: 'itemIdQuery',
      subject: 'subjectQuery',
      updatedAt: 'updatedAt',
      value: 'valueQuery'
    });
  }
  if (current?.kind !== 'model') {
    return [];
  }
  return modelColumns(current.model).map((column) => ({
    filter:
      column.filter === undefined
        ? undefined
        : columnFilter({
            filter: column.filter,
            key: column.key,
            label: column.label
          }),
    key: column.key,
    label: column.label,
    sortable: column.sortable
  }));
});

const tableRows = computed<readonly DataGridRow[]>(() => {
  const current = selection.value;
  if (current?.kind === 'annotation') {
    return annotations.value.map((record) => annotationRow(record));
  }
  if (current?.kind === 'collection') {
    return collections.value.map((record) => collectionRow(record));
  }
  if (current?.kind !== 'model') {
    return [];
  }
  const columns = modelColumns(current.model);
  return dataset.value.rows.map((row, index) => datasetRow(row, index, columns));
});

const inspectorViews = computed(() => {
  const views = new Map<string, InspectorView>();
  if (selection.value?.kind === 'annotation') {
    for (const record of annotations.value) {
      views.set(annotationRef(record).id, annotationView(record));
    }
  } else if (selection.value?.kind === 'collection') {
    for (const record of collections.value) {
      views.set(collectionRef(record).id, collectionView(record));
    }
  } else if (selection.value?.kind === 'model') {
    const columns = modelColumns(selection.value.model);
    dataset.value.rows.forEach((row, index) => {
      views.set(rowKey(row, index), datasetView(row, columns));
    });
  } else if (selection.value?.kind === 'relatedData') {
    for (const section of summarySections.value) {
      for (const row of section.rows) {
        if (row.inspectorView !== undefined) {
          views.set(row.id, row.inspectorView);
        }
      }
    }
  }
  return views;
});

const selectedRowId = computed(() => inspector.value?.id ?? null);
const inspectorView = computed(() => inspector.value?.view ?? null);
const layoutStyle = computed<Record<string, string>>(() => ({
  '--data-page-inspector-width': `${String(inspectorWidth.value)}px`,
  '--data-page-tree-width': `${String(treeWidth.value)}px`
}));
const tableStorageKey = computed(() =>
  selection.value === null ? 'empty' : selectionStorageKey(selection.value)
);
onMounted(() => {
  void loadInitialView();
});

onBeforeUnmount(() => {
  cleanupLayoutResize?.();
});

async function loadInitialView(): Promise<void> {
  busy.value = true;
  loadError.value = null;
  tableError.value = null;
  try {
    overview.value = await api.overview();
    const initial = selectionFromRoute(overview.value) ?? firstSelection(overview.value);
    if (initial !== null) {
      await selectNode(initial);
    }
  } catch (error) {
    loadError.value = errorMessage(error);
  } finally {
    busy.value = false;
  }
}

async function selectNode(next: Selection): Promise<void> {
  selection.value = next;
  writeSelectionRoute(next);
  inspector.value = null;
  modelFilters.value = {};
  modelFilterDrafts.value = emptyFilterDraftsForSelection(next);
  filterError.value = null;
  sortState.value = null;
  summarySorts.value = {};
  tableError.value = null;
  pageOffset.value = 0;
  await loadSelectionPage(next, 0, pageSize.value);
}

async function changePage(value: { limit: number; offset: number }): Promise<void> {
  if (selection.value === null) {
    return;
  }
  inspector.value = null;
  await loadSelectionPage(selection.value, value.offset, value.limit);
}

async function changePageSize(value: number): Promise<void> {
  pageSize.value = value;
  writeStorage(PAGE_SIZE_KEY, String(value));
  if (selection.value === null) {
    return;
  }
  inspector.value = null;
  await loadSelectionPage(selection.value, 0, value);
}

async function loadSelectionPage(next: Selection, offset: number, limit: number): Promise<void> {
  busy.value = true;
  tableError.value = null;
  if (next.kind !== 'relatedData') {
    summarySections.value = [];
    activeSummaryId.value = null;
  }
  try {
    if (next.kind === 'annotation') {
      const where = derivedFilterWhere('annotation');
      if (where === null) {
        annotations.value = [];
        collections.value = [];
        dataset.value = { rows: [] };
        applyPage({ hasMore: false, total: 0 }, offset);
        return;
      }
      const page = await api.browseAnnotations({
        key: next.key,
        limit,
        offset,
        sort: sortState.value ?? undefined,
        where
      });
      annotations.value = page.rows;
      collections.value = [];
      dataset.value = { rows: [] };
      applyPage(page, offset);
      return;
    }
    if (next.kind === 'collection') {
      const where = derivedFilterWhere('collection');
      if (where === null) {
        collections.value = [];
        annotations.value = [];
        dataset.value = { rows: [] };
        applyPage({ hasMore: false, total: 0 }, offset);
        return;
      }
      const page = await api.browseCollection({
        key: next.key,
        limit,
        offset,
        sort: sortState.value ?? undefined,
        where
      });
      collections.value = page.rows;
      annotations.value = [];
      dataset.value = { rows: [] };
      applyPage(page, offset);
      return;
    }
    if (next.kind === 'relatedData') {
      summarySections.value = await loadSummarySections(next.subject);
      activeSummaryId.value = summarySections.value[0]?.id ?? null;
      dataset.value = { rows: [] };
      annotations.value = [];
      collections.value = [];
      applyPage({ hasMore: false, total: summarySections.value.length }, 0);
      return;
    }
    if (!isSelectableModel(next.model)) {
      dataset.value = { rows: [] };
      annotations.value = [];
      collections.value = [];
      applyPage({ hasMore: false, total: 0 }, offset);
      return;
    }
    const where = modelFilterWhere(next.model);
    if (where === null) {
      dataset.value = { rows: [] };
      annotations.value = [];
      collections.value = [];
      applyPage({ hasMore: false, total: 0 }, offset);
      return;
    }
    const page = await api.selectPage({
      limit,
      model: next.model,
      offset,
      sort: sortState.value ?? undefined,
      where
    });
    dataset.value = { rows: page.rows };
    annotations.value = [];
    collections.value = [];
    applyPage(page, offset);
  } catch (error) {
    tableError.value = errorMessage(error);
    annotations.value = [];
    collections.value = [];
    dataset.value = { rows: [] };
    pageHasMore.value = false;
    totalRows.value = null;
  } finally {
    busy.value = false;
  }
}

function applyPage(page: { hasMore: boolean; total?: number | undefined }, offset: number): void {
  pageOffset.value = offset;
  pageHasMore.value = page.hasMore;
  totalRows.value = page.total ?? null;
}

async function changeSort(value: SortState): Promise<void> {
  sortState.value = value;
  if (selection.value === null) {
    return;
  }
  inspector.value = null;
  await loadSelectionPage(selection.value, 0, pageSize.value);
}

async function filterCell(input: { key: string; operator: string; value: string }): Promise<void> {
  const current = selection.value;
  if (current === null) {
    return;
  }
  const option = filterOptionsForSelection(current).find((item) => item.key === input.key);
  const operator = option?.filter.operators.find((item) => item.key === input.operator);
  const value = input.value.trim();
  if (option === undefined || operator === undefined || value.length === 0) {
    return;
  }
  const filter = {
    key: option.key,
    operator: operator.key,
    value
  };
  filtersVisible.value = true;
  modelFilterDrafts.value = {
    ...emptyFilterDraftsForSelection(current),
    ...modelFilterDrafts.value,
    [option.key]: filter
  };
  modelFilters.value = { ...modelFilters.value, [option.key]: filter };
  filterError.value = null;
  inspector.value = null;
  await loadSelectionPage(current, 0, pageSize.value);
}

async function clearFilters(): Promise<void> {
  filterError.value = null;
  if (
    selection.value === null ||
    (Object.keys(modelFilters.value).length === 0 &&
      !Object.values(modelFilterDrafts.value).some((filter) => filter.value.trim().length > 0))
  ) {
    return;
  }
  modelFilters.value = {};
  modelFilterDrafts.value = emptyFilterDraftsForSelection(selection.value);
  inspector.value = null;
  await loadSelectionPage(selection.value, 0, pageSize.value);
}

async function goToSubject(subject: ModelRef): Promise<void> {
  if (!isOpenableSubject(subject)) {
    return;
  }
  const next = { kind: 'model', model: subject._model } as const;
  const refFilter = modelRefFilterOption(subject._model);
  if (refFilter === null) {
    return;
  }
  const drafts = emptyModelFilterDrafts(subject._model);
  const appliedFilter = {
    key: refFilter.option.key,
    operator: refFilter.operator.key,
    value: subject.id
  };
  drafts[appliedFilter.key] = appliedFilter;
  selection.value = next;
  writeSelectionRoute(next);
  inspector.value = null;
  modelFilterDrafts.value = drafts;
  modelFilters.value = { [appliedFilter.key]: appliedFilter };
  filtersVisible.value = true;
  filterError.value = null;
  sortState.value = null;
  tableError.value = null;
  pageOffset.value = 0;
  await loadSelectionPage(next, 0, pageSize.value);
}

async function openRelatedData(subject: ModelRef): Promise<void> {
  await selectNode({ kind: 'relatedData', model: subject._model, subject });
}

async function applyFilters(): Promise<void> {
  const definition = filterDefinition.value;
  if (selection.value === null || definition === null) {
    return;
  }
  filterError.value = null;
  modelFilters.value = activeModelFilterDrafts(definition.options);
  inspector.value = null;
  await loadSelectionPage(selection.value, 0, pageSize.value);
}

function editFilterDraft(): void {
  filterError.value = null;
}

function toggleFilters(): void {
  filtersVisible.value = !filtersVisible.value;
}

function changeSummaryMode(mode: SummaryMode): void {
  summaryMode.value = mode;
  activeSummaryId.value ??= summarySections.value[0]?.id ?? null;
}

function selectSummarySection(id: string): void {
  activeSummaryId.value = id;
}

function changeSummarySort(section: SummarySection, state: SortState): void {
  summarySorts.value = {
    ...summarySorts.value,
    [section.id]: state
  };
}

function summaryRows(section: SummarySection): readonly DataGridRow[] {
  return sortRowsBy(section.rows, summarySorts.value[section.id] ?? null);
}

function summaryCountLabel(section: SummarySection): string {
  const total = section.totalRows ?? section.rows.length;
  return section.hasMore ? `${String(section.rows.length)} / ${String(total)}` : String(total);
}

function openRow(rowId: string): void {
  if (inspector.value?.id === rowId) {
    inspector.value = null;
    return;
  }
  const view = inspectorViews.value.get(rowId);
  if (view !== undefined) {
    inspector.value = { id: rowId, view };
  }
}

function closeInspector(): void {
  inspector.value = null;
}

function startTreeResize(event: PointerEvent): void {
  startLayoutResize({
    event,
    getWidth: () => treeWidth.value,
    key: TREE_WIDTH_KEY,
    max: TREE_WIDTH_MAX,
    min: TREE_WIDTH_MIN,
    setWidth: (value) => {
      treeWidth.value = value;
    },
    sign: 1
  });
}

function startInspectorResize(event: PointerEvent): void {
  startLayoutResize({
    event,
    getWidth: () => inspectorWidth.value,
    key: INSPECTOR_WIDTH_KEY,
    max: INSPECTOR_WIDTH_MAX,
    min: INSPECTOR_WIDTH_MIN,
    setWidth: (value) => {
      inspectorWidth.value = value;
    },
    sign: -1
  });
}

function resizeTreeWithKeyboard(event: KeyboardEvent): void {
  resizeWithKeyboard(event, treeWidth, TREE_WIDTH_KEY, TREE_WIDTH_MIN, TREE_WIDTH_MAX, 1);
}

function resizeInspectorWithKeyboard(event: KeyboardEvent): void {
  resizeWithKeyboard(
    event,
    inspectorWidth,
    INSPECTOR_WIDTH_KEY,
    INSPECTOR_WIDTH_MIN,
    INSPECTOR_WIDTH_MAX,
    -1
  );
}

function startLayoutResize(input: {
  event: PointerEvent;
  getWidth: () => number;
  key: string;
  max: number;
  min: number;
  setWidth: (value: number) => void;
  sign: 1 | -1;
}): void {
  const startX = input.event.clientX;
  const startWidth = input.getWidth();
  cleanupLayoutResize?.();

  const move = (event: PointerEvent) => {
    input.setWidth(
      clampWidth(startWidth + (event.clientX - startX) * input.sign, input.min, input.max)
    );
  };
  const stop = () => {
    cleanupLayoutResize?.();
    cleanupLayoutResize = null;
    writeStorage(input.key, String(input.getWidth()));
  };

  cleanupLayoutResize = () => {
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', stop);
  };
  window.addEventListener('pointermove', move);
  window.addEventListener('pointerup', stop);
  input.event.preventDefault();
}

function resizeWithKeyboard(
  event: KeyboardEvent,
  width: { value: number },
  key: string,
  min: number,
  max: number,
  sign: 1 | -1
): void {
  if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') {
    return;
  }
  const direction = event.key === 'ArrowRight' ? 1 : -1;
  width.value = clampWidth(width.value + direction * sign * 16, min, max);
  writeStorage(key, String(width.value));
  event.preventDefault();
}

function firstSelection(value: Overview): Selection | null {
  const annotation = value.derivedStorage.annotations.byKey[0]?.key;
  if (annotation !== undefined) {
    return { kind: 'annotation', key: annotation };
  }
  const collection = value.derivedStorage.collectionItems.byKey[0]?.key;
  if (collection !== undefined) {
    return { kind: 'collection', key: collection };
  }
  const model = value.catalog.find((entry) => entry.capabilities.includes('select'))?.model;
  return model === undefined ? null : { kind: 'model', model };
}

function selectionFromRoute(value: Overview): Selection | null {
  const segment = route.value.segment(0);
  const annotation = routeValue(segment, 'annotation');
  if (
    annotation !== null &&
    value.derivedStorage.annotations.byKey.some((item) => item.key === annotation)
  ) {
    return { kind: 'annotation', key: annotation };
  }
  const collection = routeValue(segment, 'collection');
  if (
    collection !== null &&
    value.derivedStorage.collectionItems.byKey.some((item) => item.key === collection)
  ) {
    return { kind: 'collection', key: collection };
  }
  const relatedData = routeValue(segment, 'related-data');
  if (relatedData !== null) {
    const subject = parseFullRef(relatedData);
    if (subject !== null) {
      return { kind: 'relatedData', model: subject._model, subject };
    }
  }
  const model = routeValue(segment, 'model');
  if (
    model !== null &&
    value.catalog.some((entry) => entry.model === model && entry.capabilities.includes('select'))
  ) {
    return { kind: 'model', model };
  }
  return null;
}

function routeValue(segment: string | null, prefix: string): string | null {
  const marker = `${prefix}-`;
  return segment?.startsWith(marker) === true ? segment.slice(marker.length) : null;
}

async function loadSummarySections(subject: ModelRef): Promise<readonly SummarySection[]> {
  const sections: SummarySection[] = [];

  const annotationsPage = await api.browseAnnotations({
    limit: SUMMARY_PAGE_SIZE,
    offset: 0,
    subject
  });
  if ((annotationsPage.total ?? annotationsPage.rows.length) > 0) {
    sections.push({
      columns: summaryAnnotationTableColumns,
      hasMore: annotationsPage.hasMore,
      id: 'annotations',
      key: 'annotations',
      label: 'Annotations',
      rows: annotationsPage.rows.map((record) => annotationRow(record)),
      totalRows: annotationsPage.total ?? annotationsPage.rows.length
    });
  }

  for (const key of collectionKeys.value) {
    const page = await api.browseCollection({
      key,
      limit: SUMMARY_PAGE_SIZE,
      offset: 0,
      subject
    });
    if ((page.total ?? page.rows.length) > 0) {
      sections.push({
        columns: summaryCollectionTableColumns,
        hasMore: page.hasMore,
        id: `collection:${key}`,
        key,
        label: `Collection: ${key}`,
        rows: page.rows.map((record) => collectionRow(record)),
        totalRows: page.total ?? page.rows.length
      });
    }
  }

  return sections;
}

function annotationRow(record: AnnotationRecord): DataGridRow {
  const value = preview(record.value);
  return {
    cells: {
      key: record.key,
      subject: refLabel(record.subject),
      updatedAt: formatDate(record.updatedAt),
      value
    },
    clientChatId: clientChatId(record.subject) ?? undefined,
    filterValues: {
      key: record.key,
      subject: refLabel(record.subject),
      updatedAt: record.updatedAt,
      value: rawJsonValue(record.value)
    },
    id: annotationRef(record).id,
    inspectorView: annotationView(record),
    relatedDataRef: isSelectableModel(record.subject._model) ? record.subject : undefined,
    sortValues: {
      key: record.key,
      subject: refLabel(record.subject),
      updatedAt: Date.parse(record.updatedAt),
      value
    },
    subject: record.subject,
    subjectOpenable: isOpenableSubject(record.subject)
  };
}

function collectionRow(record: CollectionRecord): DataGridRow {
  const value = preview(record.value);
  return {
    cells: {
      itemId: record.itemId,
      key: record.key,
      subject: refLabel(record.subject),
      updatedAt: formatDate(record.updatedAt),
      value
    },
    clientChatId: clientChatId(record.subject) ?? undefined,
    filterValues: {
      itemId: record.itemId,
      key: record.key,
      subject: refLabel(record.subject),
      updatedAt: record.updatedAt,
      value: rawJsonValue(record.value)
    },
    id: collectionRef(record).id,
    inspectorView: collectionView(record),
    relatedDataRef: isSelectableModel(record.subject._model) ? record.subject : undefined,
    sortValues: {
      itemId: record.itemId,
      key: record.key,
      subject: refLabel(record.subject),
      updatedAt: Date.parse(record.updatedAt),
      value
    },
    subject: record.subject,
    subjectOpenable: isOpenableSubject(record.subject)
  };
}

function datasetRow(row: DatasetRow, index: number, columns: readonly ModelColumn[]): DataGridRow {
  const cells = Object.fromEntries(
    columns.map((column) => [column.key, modelColumnValue(row, column)])
  );
  const filterValues = Object.fromEntries(
    columns.map((column) => [column.key, modelColumnFilterValue(row, column)])
  );
  const ref = primaryRef(row);
  return {
    cells,
    clientChatId: clientChatRef(row)?.id,
    filterValues,
    id: rowKey(row, index),
    relatedDataRef: ref !== null && isSelectableModel(ref._model) ? ref : undefined,
    sortValues: cells
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

function annotationView(record: AnnotationRecord): InspectorView {
  return {
    actions: rowActions([record.subject]),
    fields: [
      subjectMeta(record.subject),
      { label: 'Key', value: record.key },
      { label: 'Updated', value: formatDate(record.updatedAt) },
      { label: 'Value', value: preview(record.value) }
    ],
    title: 'Annotation'
  };
}

function collectionView(record: CollectionRecord): InspectorView {
  return {
    actions: rowActions([record.subject]),
    fields: [
      subjectMeta(record.subject),
      { label: 'Key', value: record.key },
      { label: 'Item ID', value: record.itemId },
      { label: 'Updated', value: formatDate(record.updatedAt) },
      { label: 'Value', value: preview(record.value) }
    ],
    title: 'Collection item'
  };
}

function findSummarySection(): SummarySection | null {
  for (const section of summarySections.value) {
    if (section.id === activeSummaryId.value) {
      return section;
    }
  }
  return null;
}

function datasetView(row: DatasetRow, columns: readonly ModelColumn[]): InspectorView {
  const ref = primaryRef(row);
  return {
    actions: rowActions(refsOfRow(row).map((item) => item.ref)),
    fields: columns.map((column) => ({
      label: column.label,
      value: modelColumnValue(row, column)
    })),
    title: ref === null ? 'Row' : refLabel(ref)
  };
}

function modelColumns(model: string | undefined): readonly ModelColumn[] {
  const columns = overview.value?.catalog.find((entry) => entry.model === model)?.columns ?? [];
  return columns.length > 0 ? columns : fallbackModelColumns;
}

function modelFilterOptions(model: string): readonly ModelFilterOption[] {
  return modelColumns(model).flatMap((column) => {
    const filter = column.filter;
    return filter === undefined
      ? []
      : [
          {
            filter,
            key: column.key,
            label: column.label
          }
        ];
  });
}

function columnsWithFilters(
  columns: readonly DataGridColumn[],
  options: readonly ModelFilterOption[],
  filterKeys: Readonly<Record<string, string>>
): readonly DataGridColumn[] {
  return columns.map((column) => {
    const option = options.find((item) => item.key === filterKeys[column.key]);
    return option === undefined ? column : { ...column, filter: columnFilter(option) };
  });
}

function columnFilter(option: ModelFilterOption): NonNullable<DataGridColumn['filter']> {
  return {
    key: option.key,
    label: option.label,
    operators: option.filter.operators.map((operator) => ({
      key: operator.key,
      label: operator.label
    }))
  };
}

function filterOptionsForSelection(value: Selection | null): readonly ModelFilterOption[] {
  if (value?.kind === 'annotation') {
    return annotationFilterOptions;
  }
  if (value?.kind === 'collection') {
    return collectionFilterOptions;
  }
  if (value?.kind === 'model') {
    return modelFilterOptions(value.model);
  }
  return [];
}

function modelRefFilterOption(
  model: string
): { operator: ModelFilterOperator; option: ModelFilterOption } | null {
  for (const option of modelFilterOptions(model)) {
    const operator = option.filter.operators.find((item) => item.key === option.filter.refOperator);
    if (operator !== undefined) {
      return { operator, option };
    }
  }
  return null;
}

function emptyModelFilterDrafts(model: string): Record<string, ModelFilter> {
  return emptyFilterDrafts(modelFilterOptions(model));
}

function emptyFilterDraftsForSelection(value: Selection | null): Record<string, ModelFilter> {
  return emptyFilterDrafts(filterOptionsForSelection(value));
}

function emptyFilterDrafts(options: readonly ModelFilterOption[]): Record<string, ModelFilter> {
  return Object.fromEntries(
    options.map((option) => [
      option.key,
      {
        key: option.key,
        operator: option.filter.operators[0]?.key ?? 'eq',
        value: ''
      }
    ])
  );
}

function activeModelFilterDrafts(options: readonly ModelFilterOption[]): ModelFilterMap {
  const filters = Object.fromEntries(
    options.flatMap((option) => {
      const draft = modelFilterDraft(option);
      return draft.value.trim().length === 0
        ? []
        : [
            [
              option.key,
              {
                key: option.key,
                operator: draft.operator,
                value: draft.value.trim()
              }
            ]
          ];
    })
  );
  return filters;
}

function modelFilterDraft(option: ModelFilterOption): ModelFilter {
  return (
    modelFilterDrafts.value[option.key] ?? {
      key: option.key,
      operator: option.filter.operators[0]?.key ?? 'eq',
      value: ''
    }
  );
}

function modelFilterOperator(option: ModelFilterOption): string {
  return modelFilterDraft(option).operator;
}

function modelFilterValue(option: ModelFilterOption): string {
  return modelFilterDraft(option).value;
}

function setModelFilterOperator(option: ModelFilterOption, event: Event): void {
  const operator = (event.target as HTMLSelectElement).value;
  modelFilterDrafts.value = {
    ...modelFilterDrafts.value,
    [option.key]: {
      ...modelFilterDraft(option),
      operator
    }
  };
  editFilterDraft();
}

function setModelFilterValue(option: ModelFilterOption, value: string): void {
  modelFilterDrafts.value = {
    ...modelFilterDrafts.value,
    [option.key]: {
      ...modelFilterDraft(option),
      value
    }
  };
  editFilterDraft();
}

function eventValue(event: Event): string {
  return (event.target as HTMLInputElement | HTMLSelectElement).value;
}

function modelFilterInputType(option: ModelFilterOption): string {
  return option.filter.input === 'number' ? 'number' : 'text';
}

function modelColumnValue(row: DatasetRow, column: ModelColumn): string {
  return formatColumnValue(modelColumnRawValue(row, column), column.format);
}

function modelColumnFilterValue(row: DatasetRow, column: ModelColumn): string {
  return rawFilterValue(modelColumnRawValue(row, column));
}

function modelColumnRawValue(row: DatasetRow, column: ModelColumn): unknown {
  return column.source.kind === 'primaryRef'
    ? primaryRefLabel(row)
    : pathValue(row.value, column.source.path);
}

function pathValue(value: unknown, path: readonly string[]): unknown {
  let current = value;
  for (const key of path) {
    if (typeof current !== 'object' || current === null || Array.isArray(current)) {
      return undefined;
    }
    current = (current as Record<string, unknown>)[key];
  }
  return current;
}

function formatColumnValue(value: unknown, format: ModelColumn['format']): string {
  if (value === null || value === undefined) {
    return '';
  }
  if (format === 'dateTime' && typeof value === 'string') {
    return formatDate(value);
  }
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return preview(value);
}

function rawFilterValue(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return rawJsonValue(value);
}

function rawJsonValue(value: unknown): string {
  return JSON.stringify(value) ?? '';
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

function refsOfRow(row: DatasetRow): { key: string; ref: ModelRef }[] {
  return Object.entries(row.refs)
    .map(([key, ref]) => ({ key, ref }))
    .sort((left, right) => left.key.localeCompare(right.key));
}

function primaryRef(row: DatasetRow): ModelRef | null {
  return refsOfRow(row)[0]?.ref ?? null;
}

function primaryRefLabel(row: DatasetRow): string {
  const ref = primaryRef(row);
  return ref === null ? '' : refLabel(ref);
}

function clientChatRef(row: DatasetRow): ModelRef | null {
  return refsOfRow(row).find((item) => clientChatId(item.ref) !== null)?.ref ?? null;
}

function clientChatId(ref: ModelRef): string | null {
  return ref._model === 'telegram.chat' && isTelegramIntegerId(ref.id) ? ref.id : null;
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

function rowKey(row: DatasetRow, index: number): string {
  const ref = primaryRef(row);
  return ref === null ? String(index) : `${ref._model}:${ref.id}:${String(index)}`;
}

function refLabel(ref: ModelRef): string {
  return `${ref._model}:${ref.id}`;
}

function parseFullRef(value: string): ModelRef | null {
  const separator = value.indexOf(':');
  if (separator <= 0 || separator === value.length - 1) {
    return null;
  }
  return {
    _model: value.slice(0, separator),
    id: value.slice(separator + 1)
  };
}

function subjectMeta(ref: ModelRef): InspectorView['fields'][number] {
  if (isOpenableSubject(ref)) {
    return { label: 'Subject', ref, value: refLabel(ref) };
  }
  return { label: 'Subject', value: refLabel(ref) };
}

function rowActions(refs: readonly ModelRef[]): InspectorView['actions'] {
  const actions: InspectorAction[] = [];
  const ref = refs[0];
  if (ref !== undefined && isSelectableModel(ref._model)) {
    actions.push({ label: 'Open related data', ref });
  }
  const chat = refs.find((item) => clientChatId(item) !== null);
  if (chat !== undefined) {
    actions.push({ href: clientPathForChat(chat.id), label: 'Open in client' });
  }
  return actions;
}

function isSelectableModel(model: string): boolean {
  return selectableModels.value.some((entry) => entry.model === model);
}

function isOpenableSubject(ref: ModelRef): boolean {
  return (
    isSelectableModel(ref._model) &&
    modelRefFilterOption(ref._model) !== null &&
    isModelRouteSafeRef(ref)
  );
}

function modelFilterWhere(model: string): unknown | null | undefined {
  return filterWhere(modelFilterOptions(model));
}

function derivedFilterWhere(kind: 'annotation' | 'collection'): unknown | null | undefined {
  return filterWhere(kind === 'annotation' ? annotationFilterOptions : collectionFilterOptions);
}

function filterWhere(options: readonly ModelFilterOption[]): unknown | null | undefined {
  const filters = Object.values(modelFilters.value);
  if (filters.length === 0) {
    return undefined;
  }
  const where: Record<string, unknown> = {};
  for (const filter of filters) {
    const option = options.find((item) => item.key === filter.key);
    const operator = option?.filter.operators.find((item) => item.key === filter.operator);
    if (operator === undefined) {
      return null;
    }
    where[operator.whereKey] = operator.value === 'array' ? [filter.value] : filter.value;
  }
  return where;
}

function preview(value: unknown): string {
  const text = JSON.stringify(value);
  if (text === undefined) {
    return '';
  }
  return text.length > 180 ? `${text.slice(0, 177)}...` : text;
}

function formatDate(value: string): string {
  return new Date(value).toLocaleString();
}

function selectionStorageKey(value: Selection): string {
  if (value.kind === 'model') {
    return `model.${storageToken(value.model)}`;
  }
  if (value.kind === 'relatedData') {
    return `relatedData.${storageToken(refLabel(value.subject))}`;
  }
  return `${value.kind}.${storageToken(value.key)}`;
}

function storageToken(value: string): string {
  return value.replace(/[^A-Za-z0-9_.-]/g, '_');
}

function writeSelectionRoute(value: Selection): void {
  if (value.kind === 'relatedData') {
    route.value.replace([`related-data-${refLabel(value.subject)}`]);
    return;
  }
  if (value.kind === 'model') {
    route.value.replace([`model-${value.model}`]);
    return;
  }
  route.value.replace([`${value.kind}-${value.key}`]);
}

function readPageSize(): number {
  const value = Number(readStorage(PAGE_SIZE_KEY));
  return PAGE_SIZES.includes(value as (typeof PAGE_SIZES)[number]) ? value : 25;
}

function readStoredWidth(key: string, defaultValue: number, min: number, max: number): number {
  const stored = readStorage(key);
  const value = stored === null ? Number.NaN : Number(stored);
  return clampWidth(Number.isFinite(value) ? value : defaultValue, min, max);
}

function clampWidth(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.round(value)));
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

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
</script>

<template>
  <UiPage padding="none" scroll="hidden">
    <div class="data-page" :data-inspector="inspectorView !== null" :style="layoutStyle">
      <DataTree
        :annotation-keys="annotationKeys"
        :busy="busy"
        :collection-keys="collectionKeys"
        :provider-groups="providerGroups"
        :selection="selection"
        @select="selectNode"
      />

      <div
        class="data-page__resizer"
        aria-label="Resize data tree"
        aria-orientation="vertical"
        role="separator"
        tabindex="0"
        @keydown="resizeTreeWithKeyboard"
        @pointerdown="startTreeResize"
      ></div>

      <main class="data-page__table-area">
        <header class="data-page__table-header">
          <h1 class="data-page__table-title">{{ tableTitle }}</h1>
          <div class="data-page__table-actions">
            <div v-if="selection?.kind === 'relatedData'" class="data-page__summary-mode">
              <button
                type="button"
                class="data-page__summary-mode-button"
                :data-active="summaryMode === 'stack' ? 'true' : undefined"
                @click="changeSummaryMode('stack')"
              >
                Stack
              </button>
              <button
                type="button"
                class="data-page__summary-mode-button"
                :data-active="summaryMode === 'tabs' ? 'true' : undefined"
                @click="changeSummaryMode('tabs')"
              >
                Tabs
              </button>
            </div>
            <button
              v-if="filterDefinition !== null"
              type="button"
              class="data-page__filter-toggle"
              :data-active="filtersVisible ? 'true' : undefined"
              :title="filtersToggleTitle"
              @click="toggleFilters"
            >
              <SolarSettingsBold class="data-page__filter-icon" aria-hidden="true" />
              <span class="data-page__filter-toggle-label">Filters</span>
            </button>
          </div>
        </header>

        <form
          v-if="filtersVisible && filterDefinition !== null"
          class="data-page__filters"
          @submit.prevent="applyFilters"
        >
          <label
            v-for="option in filterDefinition.options"
            :key="option.key"
            class="data-page__filter-field"
          >
            <span class="data-page__filter-name">{{ option.label }}</span>
            <select
              v-if="option.filter.operators.length > 1"
              class="data-page__filter-select"
              :value="modelFilterOperator(option)"
              @change="setModelFilterOperator(option, $event)"
            >
              <option
                v-for="operator in option.filter.operators"
                :key="operator.key"
                :value="operator.key"
              >
                {{ operator.label }}
              </option>
            </select>
            <span v-else class="data-page__filter-operator">
              {{ option.filter.operators[0]?.label }}
            </span>
            <select
              v-if="option.filter.input === 'enum'"
              class="data-page__filter-input"
              :value="modelFilterValue(option)"
              @change="setModelFilterValue(option, eventValue($event))"
            >
              <option value=""></option>
              <option
                v-for="item in option.filter.values ?? []"
                :key="item.value"
                :value="item.value"
              >
                {{ item.label }}
              </option>
            </select>
            <input
              v-else
              class="data-page__filter-input"
              :inputmode="
                option.filter.input === 'id' || option.filter.input === 'number'
                  ? 'numeric'
                  : undefined
              "
              :placeholder="option.filter.placeholder ?? option.label"
              :type="modelFilterInputType(option)"
              :value="modelFilterValue(option)"
              spellcheck="false"
              @input="setModelFilterValue(option, eventValue($event))"
            />
          </label>
          <div class="data-page__filter-actions">
            <button type="submit" class="data-page__filter-command" :disabled="busy">Apply</button>
            <button
              v-if="canClearFilter"
              type="button"
              class="data-page__filter-command"
              :disabled="busy"
              @click="clearFilters"
            >
              Clear
            </button>
            <span v-if="filterError !== null" class="data-page__filter-error">
              {{ filterError }}
            </span>
          </div>
        </form>

        <div v-if="loadError !== null" class="data-page__error">{{ loadError }}</div>
        <div v-if="tableError !== null" class="data-page__error">{{ tableError }}</div>

        <section v-if="selection?.kind === 'relatedData'" class="data-page__summary">
          <section v-if="busy" class="data-page__empty">Loading</section>
          <section v-else-if="summarySections.length === 0" class="data-page__empty">
            No related data
          </section>
          <div v-else class="data-page__summary-content" :data-mode="summaryMode">
            <div v-if="summaryMode === 'tabs'" class="data-page__summary-tabs" role="tablist">
              <button
                v-for="section in summarySections"
                :key="section.id"
                type="button"
                class="data-page__summary-tab"
                :aria-controls="`summary-panel-${section.id}`"
                :aria-selected="activeSummaryId === section.id"
                :data-active="activeSummaryId === section.id ? 'true' : undefined"
                role="tab"
                @click="selectSummarySection(section.id)"
              >
                <span class="data-page__summary-tab-label">{{ section.label }}</span>
                <span class="data-page__summary-count">{{ summaryCountLabel(section) }}</span>
              </button>
            </div>

            <section
              v-for="section in visibleSummarySections"
              :key="section.id"
              :id="summaryMode === 'tabs' ? `summary-panel-${section.id}` : undefined"
              class="data-page__summary-section"
              :role="summaryMode === 'tabs' ? 'tabpanel' : undefined"
            >
              <header class="data-page__summary-header">
                <h2 class="data-page__summary-title">{{ section.label }}</h2>
                <span class="data-page__summary-count">{{ summaryCountLabel(section) }}</span>
              </header>
              <DataGrid
                :busy="false"
                :columns="section.columns"
                :empty-action-label="null"
                :empty-label="emptyLabel"
                :has-more="false"
                :page-offset="0"
                :page-size="SUMMARY_PAGE_SIZE"
                :rows="summaryRows(section)"
                :selected-row-id="selectedRowId"
                :show-footer="false"
                :sort-state="summarySorts[section.id] ?? null"
                :storage-key="`summary.${section.id}`"
                :total-rows="section.totalRows"
                @change-sort="changeSummarySort(section, $event)"
                @go-to-subject="goToSubject"
                @open-client-chat="openClientChat"
                @open-related-data="openRelatedData"
                @select-row="openRow"
              />
            </section>
          </div>
        </section>

        <section v-else-if="selection !== null" class="data-page__grid-shell">
          <DataGrid
            :busy="busy"
            :columns="tableColumns"
            :empty-action-label="hasActiveFilter ? 'Reset filters' : null"
            :empty-label="emptyLabel"
            :has-more="pageHasMore"
            :page-offset="pageOffset"
            :page-size="pageSize"
            :rows="tableRows"
            :selected-row-id="selectedRowId"
            :show-footer="true"
            :sort-state="sortState"
            :storage-key="tableStorageKey"
            :total-rows="totalRows"
            @change-page="changePage"
            @change-page-size="changePageSize"
            @change-sort="changeSort"
            @clear-filter="clearFilters"
            @filter-cell="filterCell"
            @go-to-subject="goToSubject"
            @open-client-chat="openClientChat"
            @open-related-data="openRelatedData"
            @select-row="openRow"
          />
        </section>
        <section v-else class="data-page__empty">No data selected</section>
      </main>

      <div
        v-if="inspectorView !== null"
        class="data-page__resizer"
        aria-label="Resize inspector"
        aria-orientation="vertical"
        role="separator"
        tabindex="0"
        @keydown="resizeInspectorWithKeyboard"
        @pointerdown="startInspectorResize"
      ></div>

      <DataInspector
        v-if="inspectorView !== null"
        :view="inspectorView"
        @close="closeInspector"
        @go-to-ref="goToSubject"
        @open-href="openHref"
        @open-related-data="openRelatedData"
      />
    </div>
  </UiPage>
</template>

<style scoped>
@reference "tailwindcss";

.data-page {
  @apply grid h-full min-h-0 grid-cols-1 overscroll-none bg-zinc-50 text-sm text-zinc-950 xl:grid-cols-[var(--data-page-tree-width)_0.25rem_minmax(0,1fr)];
}

.data-page[data-inspector='true'] {
  @apply xl:grid-cols-[var(--data-page-tree-width)_0.25rem_minmax(0,1fr)_0.25rem_var(--data-page-inspector-width)];
}

.data-page__resizer {
  @apply hidden cursor-col-resize bg-zinc-100 hover:bg-zinc-300 focus-visible:bg-zinc-400 focus-visible:outline-none xl:block;
}

.data-page__table-area {
  @apply flex min-h-0 min-w-0 flex-col overflow-hidden overscroll-none bg-white;
}

.data-page__table-header {
  @apply flex h-10 shrink-0 items-center gap-3 border-b border-zinc-200 px-4;
}

.data-page__table-title {
  @apply min-w-0 truncate text-sm font-semibold tracking-normal text-zinc-950;
}

.data-page__table-actions {
  @apply ml-auto flex min-w-0 shrink-0 items-center gap-2;
}

.data-page__filter-icon {
  @apply h-3.5 w-3.5 shrink-0;
}

.data-page__filter-toggle {
  @apply inline-flex h-7 shrink-0 items-center gap-1 border border-zinc-300 bg-white px-2 text-xs font-semibold text-zinc-700 hover:border-zinc-400 hover:text-zinc-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500;
}

.data-page__filter-toggle[data-active='true'] {
  @apply border-teal-600 bg-teal-50 text-teal-950;
}

.data-page__filter-toggle-label {
  @apply hidden sm:inline;
}

.data-page__filters {
  @apply grid shrink-0 gap-2 border-b border-zinc-200 bg-zinc-50 px-4 py-2 text-xs;
}

.data-page__filter-field {
  @apply grid min-w-0 grid-cols-[7rem_5rem_minmax(0,1fr)] items-center gap-2;
}

.data-page__filter-name {
  @apply shrink-0 font-semibold text-zinc-600;
}

.data-page__filter-operator {
  @apply shrink-0 font-mono text-[11px] text-zinc-500;
}

.data-page__filter-input {
  @apply h-7 min-w-0 w-full border border-zinc-300 bg-white px-2 font-mono text-[11px] text-zinc-800 placeholder:text-zinc-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500;
}

.data-page__filter-select {
  @apply h-7 min-w-0 w-full border border-zinc-300 bg-white px-2 text-xs text-zinc-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500;
}

.data-page__filter-actions {
  @apply flex items-center gap-2;
}

.data-page__filter-command {
  @apply h-7 border border-zinc-300 bg-white px-3 text-xs font-semibold text-zinc-700 hover:border-teal-500 hover:text-teal-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 disabled:cursor-default disabled:opacity-50;
}

.data-page__filter-error {
  @apply min-w-0 truncate text-red-700;
}

.data-page__summary-mode {
  @apply inline-flex shrink-0 border border-zinc-300 bg-white;
}

.data-page__summary-mode-button {
  @apply h-7 px-2 text-xs font-semibold text-zinc-600 hover:bg-zinc-50 hover:text-zinc-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-teal-500;
}

.data-page__summary-mode-button[data-active='true'] {
  @apply bg-teal-50 text-teal-950;
}

.data-page__summary {
  @apply min-h-0 flex-1 overflow-auto overscroll-none bg-white;
}

.data-page__summary-content {
  @apply grid min-h-full gap-0 bg-white;
}

.data-page__summary-content[data-mode='stack'] {
  @apply content-start;
}

.data-page__summary-content[data-mode='tabs'] {
  @apply grid-rows-[auto_minmax(0,1fr)];
}

.data-page__summary-tabs {
  @apply sticky top-0 z-20 flex items-end gap-1 overflow-x-auto overscroll-none border-b border-zinc-300 bg-zinc-100 px-3 pt-2;
}

.data-page__summary-tab {
  @apply -mb-px inline-flex h-8 shrink-0 items-center gap-2 rounded-t-md border border-transparent border-b-zinc-300 bg-zinc-200 px-3 text-xs font-semibold text-zinc-600 hover:bg-zinc-50 hover:text-zinc-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-teal-500;
}

.data-page__summary-tab[data-active='true'] {
  @apply border-zinc-300 border-b-white bg-white text-zinc-950 shadow-sm;
}

.data-page__summary-tab-label {
  @apply max-w-56 truncate;
}

.data-page__summary-section {
  @apply grid min-w-0 border-b border-zinc-200;
}

.data-page__summary-content[data-mode='tabs'] .data-page__summary-section {
  @apply min-h-0 grid-rows-[auto_minmax(0,1fr)] border-b-0;
}

.data-page__summary-header {
  @apply flex h-8 items-center gap-2 bg-zinc-50 px-3 text-xs;
}

.data-page__summary-content[data-mode='tabs'] .data-page__summary-header {
  @apply h-10 border-b border-zinc-200 bg-white px-4;
}

.data-page__summary-title {
  @apply min-w-0 flex-1 truncate font-semibold text-zinc-900;
}

.data-page__summary-content[data-mode='tabs'] .data-page__summary-title {
  @apply text-sm text-zinc-950;
}

.data-page__summary-count {
  @apply shrink-0 font-mono text-[11px] text-zinc-500;
}

.data-page__grid-shell {
  @apply flex min-h-0 flex-1 flex-col;
}

.data-page__error {
  @apply border-b border-red-200 bg-red-50 px-4 py-2 text-xs text-red-700;
}

.data-page__empty {
  @apply flex min-h-0 flex-1 items-center justify-center p-8 text-sm text-zinc-500;
}
</style>
