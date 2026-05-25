import { computed, shallowRef, watch } from 'vue';

import { entityById } from './schemaIndex.js';
import type { CardInstance, ExplorerColumn, HoverPreview, SearchEntryKind } from './types.js';

const allKinds: SearchEntryKind[] = [
  'type',
  'constructor',
  'update',
  'function',
  'field',
  'scalar'
];
const layoutStorageKey = 'tdlib-docs:layout:v1';
const stableInlineParentPrefixes = [
  'favorites',
  'schema-constructor:',
  'schema-table-column:',
  'schema-table-detail:',
  'schema-type-detail:',
  'schema-update-process:',
  'schema-update:',
  'storage-row:'
];
let instanceCounter = 0;
let columnCounter = 0;
const restoredLayout = readPersistedLayout();
const initialColumns = restoredLayout?.columns ?? [createColumn()];
const initialInlineCards = new Map(restoredLayout?.inlineCards ?? []);
syncCounters(initialColumns, initialInlineCards);

export const searchQuery = shallowRef(restoredLayout?.searchQuery ?? '');
export const enabledSearchKinds = shallowRef<Set<SearchEntryKind>>(new Set(allKinds));
export const columns = shallowRef<ExplorerColumn[]>(initialColumns);
export const activeColumnId = shallowRef(
  resolveInitialActiveColumnId(restoredLayout?.activeColumnId, initialColumns)
);
export const inlineCards = shallowRef<Map<string, CardInstance[]>>(initialInlineCards);
export const favoriteEntityIds = shallowRef<string[]>(restoredLayout?.favoriteEntityIds ?? []);
export const columnScrollTops = shallowRef<Map<string, number>>(
  new Map(restoredLayout?.columnScrollTops ?? [])
);
export const workspaceScrollLeft = shallowRef(restoredLayout?.workspaceScrollLeft ?? 0);
export const hoverKey = shallowRef<string | null>(null);
export const hoverPreview = shallowRef<HoverPreview | null>(null);
export const hasOpenCards = computed(
  () => columns.value.length > 1 || columns.value.some((column) => column.card !== undefined)
);
export const hasMultipleColumns = computed(() => columns.value.length > 1);
export const activeColumnIsEmpty = computed(() => {
  const activeColumn = columns.value.find((column) => column.columnId === activeColumnId.value);
  return activeColumn?.card === undefined;
});

export function toggleSearchKind(kind: SearchEntryKind): void {
  const next = new Set(enabledSearchKinds.value);
  if (next.has(kind)) {
    next.delete(kind);
  } else {
    next.add(kind);
  }
  enabledSearchKinds.value = next.size === 0 ? new Set(allKinds) : next;
}

export function openInActiveColumn(entityId: string, focusField?: string): void {
  if (!entityById.has(entityId)) {
    return;
  }

  const columnId = ensureActiveColumnId();
  replaceColumnCard(columnId, createCard(entityId, focusField));
}

export function openInNewColumn(entityId: string, focusField?: string): void {
  if (!entityById.has(entityId)) {
    return;
  }

  const column = createColumn(createCard(entityId, focusField));
  columns.value = [...columns.value, column];
  activeColumnId.value = column.columnId;
}

export function selectColumn(columnId: string): void {
  if (columns.value.some((column) => column.columnId === columnId)) {
    activeColumnId.value = columnId;
  }
}

export function openInline(
  parentInstanceId: string,
  slotKey: string,
  entityId: string,
  focusField?: string
): void {
  if (!entityById.has(entityId)) {
    return;
  }

  const key = inlineKey(parentInstanceId, slotKey);
  const existing = inlineCards.value.get(key) ?? [];
  if (existing.some((card) => card.entityId === entityId && card.focusField === focusField)) {
    return;
  }

  const next = new Map(inlineCards.value);
  next.set(key, [...existing, createCard(entityId, focusField)]);
  inlineCards.value = next;
}

export function toggleInline(
  parentInstanceId: string,
  slotKey: string,
  entityId: string,
  focusField?: string
): void {
  if (!entityById.has(entityId)) {
    return;
  }

  const key = inlineKey(parentInstanceId, slotKey);
  const existing = (inlineCards.value.get(key) ?? []).find(
    (card) => card.entityId === entityId && card.focusField === focusField
  );

  if (existing !== undefined) {
    closeCard(existing.instanceId);
    return;
  }

  openInline(parentInstanceId, slotKey, entityId, focusField);
}

export function embedConstructorInOwnerType(
  constructorInstanceId: string,
  ownerTypeEntityId: string
): void {
  const ownerType = entityById.get(ownerTypeEntityId);
  const location = findCardLocation(constructorInstanceId);
  if (ownerType?.kind !== 'type' || location === null) {
    return;
  }

  const constructorEntity = entityById.get(location.card.entityId);
  if (
    constructorEntity?.kind !== 'constructor' ||
    constructorEntity.resultType !== ownerType.name
  ) {
    return;
  }

  if (
    location.kind === 'inline' &&
    slotFromInlineKey(location.key) === constructorSlot(constructorEntity.name)
  ) {
    const parentCard = findCardLocation(parentFromInlineKey(location.key))?.card ?? null;
    if (parentCard?.entityId === ownerTypeEntityId) {
      return;
    }
  }

  const ownerTypeCard = createCard(ownerTypeEntityId);
  if (location.kind === 'column') {
    replaceColumnCard(location.columnId, ownerTypeCard);
  }

  const nextInlineCards = new Map(inlineCards.value);
  if (location.kind === 'inline') {
    const cards = nextInlineCards.get(location.key) ?? [];
    nextInlineCards.set(
      location.key,
      cards.map((card, index) => (index === location.index ? ownerTypeCard : card))
    );
  }

  nextInlineCards.set(
    inlineKey(ownerTypeCard.instanceId, constructorSlot(constructorEntity.name)),
    [location.card]
  );
  inlineCards.value = nextInlineCards;
}

export function closeCard(instanceId: string): void {
  const location = findCardLocation(instanceId);
  if (location?.kind === 'column') {
    closeColumn(location.columnId);
    return;
  }

  const descendants = descendantInstanceIds(instanceId);
  const closed = new Set([instanceId, ...descendants]);
  removeClosedInlineCards(closed);
}

export function closeAllCards(): void {
  const column = createColumn();
  columns.value = [column];
  activeColumnId.value = column.columnId;
  inlineCards.value = new Map();
  columnScrollTops.value = new Map();
  workspaceScrollLeft.value = 0;
}

export function closeInlineCardsByParentPrefix(parentPrefixes: string[]): void {
  const matchedKeys = new Set<string>();
  const closed = new Set<string>();

  for (const [key, cards] of inlineCards.value.entries()) {
    const parent = parentFromInlineKey(key);
    if (!parentPrefixes.some((prefix) => parent.startsWith(prefix))) {
      continue;
    }

    matchedKeys.add(key);
    for (const card of cards) {
      closed.add(card.instanceId);
      for (const descendantId of descendantInstanceIds(card.instanceId)) {
        closed.add(descendantId);
      }
    }
  }

  if (matchedKeys.size === 0 && closed.size === 0) {
    return;
  }

  const next = new Map<string, CardInstance[]>();
  for (const [key, cards] of inlineCards.value.entries()) {
    if (matchedKeys.has(key) || closed.has(parentFromInlineKey(key))) {
      continue;
    }

    const remaining = cards.filter((card) => !closed.has(card.instanceId));
    if (remaining.length > 0) {
      next.set(key, remaining);
    }
  }
  inlineCards.value = next;
}

export function isFavoriteEntity(entityId: string): boolean {
  return favoriteEntityIds.value.includes(entityId);
}

export function toggleFavoriteEntity(entityId: string): void {
  if (!entityById.has(entityId)) {
    return;
  }

  if (favoriteEntityIds.value.includes(entityId)) {
    removeFavoriteEntity(entityId);
    return;
  }

  favoriteEntityIds.value = [...favoriteEntityIds.value, entityId];
}

export function removeFavoriteEntity(entityId: string): void {
  favoriteEntityIds.value = favoriteEntityIds.value.filter((item) => item !== entityId);
}

export function cardsForSlot(parentInstanceId: string, slotKey: string): CardInstance[] {
  return inlineCards.value.get(inlineKey(parentInstanceId, slotKey)) ?? [];
}

export function setHoverKey(key: string | null): void {
  hoverKey.value = key;
}

export function showHoverPreview(entityId: string, event: MouseEvent): void {
  hoverPreview.value = {
    entityId,
    left: Math.min(event.clientX + 16, window.innerWidth - 360),
    top: Math.min(event.clientY + 18, window.innerHeight - 240)
  };
}

export function hideHoverPreview(): void {
  hoverPreview.value = null;
}

export function setColumnScrollTop(columnId: string, scrollTop: number): void {
  if (!columns.value.some((column) => column.columnId === columnId)) {
    return;
  }

  const nextScrollTop = normalizeScrollValue(scrollTop);
  if (columnScrollTops.value.get(columnId) === nextScrollTop) {
    return;
  }

  const next = new Map(columnScrollTops.value);
  next.set(columnId, nextScrollTop);
  columnScrollTops.value = next;
}

export function setWorkspaceScrollLeft(scrollLeft: number): void {
  const nextScrollLeft = normalizeScrollValue(scrollLeft);
  if (workspaceScrollLeft.value === nextScrollLeft) {
    return;
  }

  workspaceScrollLeft.value = nextScrollLeft;
}

watch(
  [
    searchQuery,
    columns,
    activeColumnId,
    inlineCards,
    favoriteEntityIds,
    columnScrollTops,
    workspaceScrollLeft
  ],
  persistLayout
);

type PersistedLayout = {
  activeColumnId: string;
  columnScrollTops: [string, number][];
  columns: ExplorerColumn[];
  favoriteEntityIds: string[];
  inlineCards: [string, CardInstance[]][];
  searchQuery: string;
  version: 1;
  workspaceScrollLeft: number;
};

function readPersistedLayout(): PersistedLayout | null {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const rawValue = window.localStorage.getItem(layoutStorageKey);
    if (rawValue === null) {
      return null;
    }

    return normalizePersistedLayout(JSON.parse(rawValue));
  } catch {
    return null;
  }
}

function persistLayout(): void {
  if (typeof window === 'undefined') {
    return;
  }

  const columnIds = new Set(columns.value.map((column) => column.columnId));
  const layout: PersistedLayout = {
    activeColumnId: activeColumnId.value,
    columnScrollTops: [...columnScrollTops.value.entries()].filter(([columnId]) =>
      columnIds.has(columnId)
    ),
    columns: columns.value,
    favoriteEntityIds: favoriteEntityIds.value,
    inlineCards: [...inlineCards.value.entries()].filter(([, cards]) => cards.length > 0),
    searchQuery: searchQuery.value,
    version: 1,
    workspaceScrollLeft: workspaceScrollLeft.value
  };

  try {
    window.localStorage.setItem(layoutStorageKey, JSON.stringify(layout));
  } catch {
    // Browser storage can be unavailable in private or restricted file contexts.
  }
}

function normalizePersistedLayout(value: unknown): PersistedLayout | null {
  if (!isRecord(value) || value.version !== 1) {
    return null;
  }

  const columnsValue = Array.isArray(value.columns) ? value.columns : [];
  const normalizedColumns = columnsValue
    .map((column) => normalizeColumn(column))
    .filter((column): column is ExplorerColumn => column !== null);
  if (normalizedColumns.length === 0) {
    return null;
  }

  const inlineCardsValue = Array.isArray(value.inlineCards) ? value.inlineCards : [];
  const normalizedInlineCards = pruneInlineCards(
    normalizedColumns,
    normalizeInlineCardEntries(inlineCardsValue)
  );
  const activeColumnId =
    typeof value.activeColumnId === 'string'
      ? resolveInitialActiveColumnId(value.activeColumnId, normalizedColumns)
      : (normalizedColumns[0]?.columnId ?? '');

  return {
    activeColumnId,
    columnScrollTops: normalizeColumnScrollTops(value.columnScrollTops, normalizedColumns),
    columns: normalizedColumns,
    favoriteEntityIds: normalizeFavoriteEntityIds(value.favoriteEntityIds),
    inlineCards: normalizedInlineCards,
    searchQuery: typeof value.searchQuery === 'string' ? value.searchQuery : '',
    version: 1,
    workspaceScrollLeft: normalizeScrollValue(value.workspaceScrollLeft)
  };
}

function normalizeColumn(value: unknown): ExplorerColumn | null {
  if (!isRecord(value) || !isColumnId(value.columnId)) {
    return null;
  }

  const card = normalizeCard(value.card);
  return {
    ...(card === null ? {} : { card }),
    columnId: value.columnId
  };
}

function normalizeCard(value: unknown): CardInstance | null {
  if (
    !isRecord(value) ||
    typeof value.entityId !== 'string' ||
    !entityById.has(value.entityId) ||
    !isCardId(value.instanceId)
  ) {
    return null;
  }

  return {
    entityId: value.entityId,
    ...(typeof value.focusField === 'string' ? { focusField: value.focusField } : {}),
    instanceId: value.instanceId
  };
}

function normalizeInlineCardEntries(value: unknown[]): [string, CardInstance[]][] {
  const entries: [string, CardInstance[]][] = [];
  for (const entry of value) {
    if (!Array.isArray(entry) || entry.length !== 2) {
      continue;
    }

    const key: unknown = entry[0];
    const cards: unknown = entry[1];
    if (typeof key !== 'string' || !key.includes('::') || !Array.isArray(cards)) {
      continue;
    }

    const normalizedCards = cards
      .map((card) => normalizeCard(card))
      .filter((card): card is CardInstance => card !== null);
    if (normalizedCards.length > 0) {
      entries.push([key, normalizedCards]);
    }
  }

  return entries;
}

function pruneInlineCards(
  restoredColumns: ExplorerColumn[],
  restoredInlineCards: [string, CardInstance[]][]
): [string, CardInstance[]][] {
  const result: [string, CardInstance[]][] = [];
  const attachedInstanceIds = new Set(
    restoredColumns.map((column) => column.card?.instanceId).filter((id) => id !== undefined)
  );
  const usedIndexes = new Set<number>();

  for (const [index, [key, cards]] of restoredInlineCards.entries()) {
    if (!hasStableInlineParent(key)) {
      continue;
    }

    usedIndexes.add(index);
    result.push([key, cards]);
    for (const card of cards) {
      attachedInstanceIds.add(card.instanceId);
    }
  }

  let changed = true;

  while (changed) {
    changed = false;
    for (const [index, [key, cards]] of restoredInlineCards.entries()) {
      if (usedIndexes.has(index) || !attachedInstanceIds.has(parentFromInlineKey(key))) {
        continue;
      }

      usedIndexes.add(index);
      result.push([key, cards]);
      for (const card of cards) {
        attachedInstanceIds.add(card.instanceId);
      }
      changed = true;
    }
  }

  return result;
}

function hasStableInlineParent(key: string): boolean {
  const parent = parentFromInlineKey(key);

  return stableInlineParentPrefixes.some((prefix) =>
    prefix.endsWith(':') ? parent.startsWith(prefix) : parent === prefix
  );
}

function normalizeColumnScrollTops(
  value: unknown,
  restoredColumns: ExplorerColumn[]
): [string, number][] {
  if (!Array.isArray(value)) {
    return [];
  }

  const columnIds = new Set(restoredColumns.map((column) => column.columnId));
  const entries: [string, number][] = [];
  for (const entry of value) {
    if (!Array.isArray(entry) || entry.length !== 2) {
      continue;
    }

    const columnId: unknown = entry[0];
    const scrollTop: unknown = entry[1];
    if (typeof columnId === 'string' && columnIds.has(columnId)) {
      entries.push([columnId, normalizeScrollValue(scrollTop)]);
    }
  }

  return entries;
}

function normalizeFavoriteEntityIds(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const result: string[] = [];
  const seen = new Set<string>();
  for (const entityId of value) {
    if (typeof entityId !== 'string' || !entityById.has(entityId) || seen.has(entityId)) {
      continue;
    }

    seen.add(entityId);
    result.push(entityId);
  }

  return result;
}

function resolveInitialActiveColumnId(
  restoredActiveColumnId: string | undefined,
  restoredColumns: ExplorerColumn[]
): string {
  if (
    restoredActiveColumnId !== undefined &&
    restoredColumns.some((column) => column.columnId === restoredActiveColumnId)
  ) {
    return restoredActiveColumnId;
  }

  return restoredColumns[0]?.columnId ?? '';
}

function syncCounters(
  restoredColumns: ExplorerColumn[],
  restoredInlineCards: Map<string, CardInstance[]>
): void {
  columnCounter = Math.max(
    columnCounter,
    ...restoredColumns.map((column) => numericIdSuffix(column.columnId, 'column-'))
  );
  instanceCounter = Math.max(
    instanceCounter,
    ...restoredColumns.map((column) => numericIdSuffix(column.card?.instanceId, 'card-')),
    ...[...restoredInlineCards.values()].flatMap((cards) =>
      cards.map((card) => numericIdSuffix(card.instanceId, 'card-'))
    )
  );
}

function numericIdSuffix(value: string | undefined, prefix: string): number {
  if (!value?.startsWith(prefix)) {
    return 0;
  }

  const suffix = Number.parseInt(value.slice(prefix.length), 10);
  return Number.isFinite(suffix) ? suffix : 0;
}

function normalizeScrollValue(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isColumnId(value: unknown): value is string {
  return typeof value === 'string' && /^column-\d+$/.test(value);
}

function isCardId(value: unknown): value is string {
  return typeof value === 'string' && /^card-\d+$/.test(value);
}

function createCard(entityId: string, focusField?: string): CardInstance {
  instanceCounter += 1;
  return {
    entityId,
    instanceId: `card-${String(instanceCounter)}`,
    ...(focusField === undefined ? {} : { focusField })
  };
}

type CardLocation =
  | {
      card: CardInstance;
      columnId: string;
      kind: 'column';
    }
  | {
      card: CardInstance;
      index: number;
      kind: 'inline';
      key: string;
    };

function findCardLocation(instanceId: string): CardLocation | null {
  for (const column of columns.value) {
    if (column.card?.instanceId === instanceId) {
      return { card: column.card, columnId: column.columnId, kind: 'column' };
    }
  }

  for (const [key, cards] of inlineCards.value.entries()) {
    const index = cards.findIndex((card) => card.instanceId === instanceId);
    if (index >= 0) {
      const card = cards[index];
      return card === undefined ? null : { card, index, key, kind: 'inline' };
    }
  }

  return null;
}

function descendantInstanceIds(instanceId: string): string[] {
  const result: string[] = [];
  const queue = [instanceId];

  while (queue.length > 0) {
    const parentId = queue.shift();
    if (parentId === undefined) {
      continue;
    }

    for (const [key, cards] of inlineCards.value.entries()) {
      if (parentFromInlineKey(key) !== parentId) {
        continue;
      }

      for (const card of cards) {
        result.push(card.instanceId);
        queue.push(card.instanceId);
      }
    }
  }

  return result;
}

function inlineKey(parentInstanceId: string, slotKey: string): string {
  return `${parentInstanceId}::${slotKey}`;
}

function createColumn(card?: CardInstance): ExplorerColumn {
  columnCounter += 1;
  return {
    ...(card === undefined ? {} : { card }),
    columnId: `column-${String(columnCounter)}`
  };
}

function ensureActiveColumnId(): string {
  const activeColumn = columns.value.find((column) => column.columnId === activeColumnId.value);
  if (activeColumn !== undefined) {
    return activeColumn.columnId;
  }

  const firstColumn = columns.value[0] ?? createColumn();
  if (columns.value.length === 0) {
    columns.value = [firstColumn];
  }
  activeColumnId.value = firstColumn.columnId;
  return firstColumn.columnId;
}

function replaceColumnCard(columnId: string, card: CardInstance): void {
  const targetColumn = columns.value.find((column) => column.columnId === columnId);
  if (targetColumn?.card !== undefined) {
    removeClosedInlineCards(
      new Set([
        targetColumn.card.instanceId,
        ...descendantInstanceIds(targetColumn.card.instanceId)
      ])
    );
  }

  columns.value = columns.value.map((column) =>
    column.columnId === columnId ? { ...column, card } : column
  );
  activeColumnId.value = columnId;
}

function closeColumn(columnId: string): void {
  const column = columns.value.find((item) => item.columnId === columnId);
  if (column?.card !== undefined) {
    removeClosedInlineCards(
      new Set([column.card.instanceId, ...descendantInstanceIds(column.card.instanceId)])
    );
  }

  if (columns.value.length === 1) {
    const remainingColumn = { columnId };
    columns.value = [remainingColumn];
    activeColumnId.value = columnId;
    return;
  }

  const columnIndex = columns.value.findIndex((item) => item.columnId === columnId);
  const nextColumns = columns.value.filter((item) => item.columnId !== columnId);
  columns.value = nextColumns;
  if (activeColumnId.value !== columnId) {
    return;
  }

  const nextActiveIndex = Math.min(Math.max(0, columnIndex - 1), nextColumns.length - 1);
  activeColumnId.value = nextColumns[nextActiveIndex]?.columnId ?? '';
}

function removeClosedInlineCards(closed: Set<string>): void {
  const next = new Map<string, CardInstance[]>();
  for (const [key, cards] of inlineCards.value.entries()) {
    if (closed.has(parentFromInlineKey(key))) {
      continue;
    }

    const remaining = cards.filter((card) => !closed.has(card.instanceId));
    if (remaining.length > 0) {
      next.set(key, remaining);
    }
  }
  inlineCards.value = next;
}

function constructorSlot(name: string): string {
  return `constructor:${name}`;
}

function parentFromInlineKey(key: string): string {
  return key.split('::')[0] ?? '';
}

function slotFromInlineKey(key: string): string {
  const markerIndex = key.indexOf('::');
  return markerIndex < 0 ? '' : key.slice(markerIndex + 2);
}
