<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';

import { cardsForSlot, hideHoverPreview, setHoverKey } from '../explorerState.js';
import { resolveEntityId } from '../schemaIndex.js';
import {
  fetchStorageReviewState,
  onStorageReviewStateUpdate,
  updateStorageReviewEntry
} from '../storageReviewClient.js';
import { storageReviewButtonKey, storageReviewButtons } from '../storageReviewDisplay.js';
import type {
  StorageReviewEntry,
  StorageReviewEntryPatch,
  StorageReviewMaturity,
  StorageReviewState
} from '../storageReviewTypes.js';
import {
  persistStorageReviewViewState,
  readStorageReviewViewState,
  type StorageReviewMaturityFilter
} from '../storageReviewViewState.js';
import EntityCard from './entityCard.vue';
import EntityLink from './entityLink.vue';
import StorageReviewButtons from './storageReviewButtons.vue';
import StorageReviewInfoCard from './storageReviewInfoCard.vue';

const restoredViewState = readStorageReviewViewState();
const reviewState = ref<StorageReviewState | null>(null);
const filterText = ref(restoredViewState.filterText);
const maturityFilter = ref<StorageReviewMaturityFilter>(restoredViewState.maturityFilter);
const loadState = ref<'loading' | 'ready' | 'error'>('loading');
const saveState = ref<'saved' | 'saving' | 'error'>('saved');
const expandedReviewKeys = ref<Set<string>>(new Set(restoredViewState.expandedReviewKeys));
const pendingFieldVersions = new Map<string, number>();
let editVersion = 0;
let saveQueue = Promise.resolve();

const entries = computed(() => reviewState.value?.entries ?? []);
const storageOptions = computed(() => reviewState.value?.storageOptions ?? []);
const maturityLevels = [1, 2, 3] as const;
const typeColumnWidth = computed(() => {
  if (entries.value.length === 0) {
    return '260px';
  }

  const longestTypeLength = Math.max(...entries.value.map((entry) => entry.type.length));
  return `${longestTypeLength + 12}ch`;
});
const visibleEntries = computed(() => {
  const query = filterText.value.trim().toLowerCase();
  return entries.value.filter((entry) => {
    const matchesMaturity =
      maturityFilter.value === 'all' || entry.maturity === maturityFilter.value;
    const matchesQuery =
      query.length === 0 ||
      [entry.type, entry.storage, entry.storageTarget].some((value) =>
        value.toLowerCase().includes(query)
      );

    return matchesMaturity && matchesQuery;
  });
});
const maxReviewNoteCount = computed(() =>
  entries.value.reduce(
    (maxNoteCount, entry) =>
      Math.max(
        maxNoteCount,
        ...storageReviewButtons(entry).map((reviewButton) => reviewButton.noteCount)
      ),
    0
  )
);
const statusText = computed(() => {
  if (loadState.value === 'loading') {
    return 'Loading';
  }
  if (loadState.value === 'error' || saveState.value === 'error') {
    return 'Error';
  }
  if (saveState.value === 'saving') {
    return 'Saving';
  }

  return 'Saved';
});

watch([filterText, maturityFilter, expandedReviewKeys], () => {
  persistStorageReviewViewState({
    expandedReviewKeys: [...expandedReviewKeys.value],
    filterText: filterText.value,
    maturityFilter: maturityFilter.value,
    version: 1
  });
});

onMounted(() => {
  void loadReviewState();
  onStorageReviewStateUpdate((state) => {
    mergeStorageReviewState(state);
  });
});

function entityIdForType(entry: StorageReviewEntry): string | null {
  return resolveEntityId(entry.type);
}

function rowInstanceId(entry: StorageReviewEntry): string {
  return `storage-row:${entry.type}`;
}

function rowSlot(entry: StorageReviewEntry): string {
  return `storage-type:${entry.type}`;
}

function rowCards(entry: StorageReviewEntry) {
  return cardsForSlot(rowInstanceId(entry), rowSlot(entry));
}

function hasExpandedRow(entry: StorageReviewEntry): boolean {
  return rowCards(entry).length > 0 || expandedReviewIndexes(entry).length > 0;
}

async function loadReviewState(): Promise<void> {
  try {
    reviewState.value = await fetchStorageReviewState();
    loadState.value = 'ready';
  } catch {
    loadState.value = 'error';
  }
}

function onStorageChange(entry: StorageReviewEntry, event: Event): void {
  const target = event.currentTarget;
  if (!(target instanceof HTMLSelectElement)) {
    return;
  }

  setEntryValue(entry.type, { storage: target.value });
}

function onStorageTargetInput(entry: StorageReviewEntry, event: Event): void {
  const target = event.currentTarget;
  if (!(target instanceof HTMLInputElement)) {
    return;
  }

  setEntryValue(entry.type, { storageTarget: target.value });
}

function onMaturityChange(entry: StorageReviewEntry, maturity: StorageReviewMaturity): void {
  setEntryValue(entry.type, { maturity });
}

function isReviewExpanded(entry: StorageReviewEntry, reviewIndex: number): boolean {
  return expandedReviewKeys.value.has(storageReviewButtonKey(entry, reviewIndex));
}

function hasReviewIndicator(entry: StorageReviewEntry): boolean {
  return storageReviewButtons(entry).length > 0;
}

function expandedReviewIndexes(entry: StorageReviewEntry): number[] {
  return storageReviewButtons(entry)
    .filter((reviewButton) => isReviewExpanded(entry, reviewButton.index))
    .map((reviewButton) => reviewButton.index);
}

function toggleReviewCard(entry: StorageReviewEntry, reviewIndex: number): void {
  if (!hasReviewIndicator(entry)) {
    return;
  }

  const reviewKey = storageReviewButtonKey(entry, reviewIndex);
  const next = new Set(expandedReviewKeys.value);
  if (next.has(reviewKey)) {
    next.delete(reviewKey);
  } else {
    next.add(reviewKey);
  }
  expandedReviewKeys.value = next;
}

function closeReviewCard(entry: StorageReviewEntry, reviewIndex: number): void {
  const next = new Set(expandedReviewKeys.value);
  next.delete(storageReviewButtonKey(entry, reviewIndex));
  expandedReviewKeys.value = next;
}

function setEntryValue(typeName: string, patch: StorageReviewEntryPatch): void {
  updateLocalEntry(typeName, patch);
  const fieldKeys = Object.keys(patch).map((fieldName) => `${typeName}:${fieldName}`);
  const version = ++editVersion;
  for (const fieldKey of fieldKeys) {
    pendingFieldVersions.set(fieldKey, version);
  }

  saveState.value = 'saving';
  saveQueue = saveQueue.then(async () => {
    try {
      const state = await updateStorageReviewEntry(typeName, patch);
      for (const fieldKey of fieldKeys) {
        if (pendingFieldVersions.get(fieldKey) === version) {
          pendingFieldVersions.delete(fieldKey);
        }
      }
      mergeStorageReviewState(state);
      saveState.value = pendingFieldVersions.size > 0 ? 'saving' : 'saved';
    } catch {
      saveState.value = 'error';
    }
  });
}

function updateLocalEntry(typeName: string, patch: StorageReviewEntryPatch): void {
  const current = reviewState.value;
  if (current === null) {
    return;
  }

  reviewState.value = {
    ...current,
    entries: current.entries.map((entry) =>
      entry.type === typeName
        ? {
            ...entry,
            ...patch
          }
        : entry
    )
  };
}

function mergeStorageReviewState(incoming: StorageReviewState): void {
  const localByType = new Map(entries.value.map((entry) => [entry.type, entry]));
  reviewState.value = {
    ...incoming,
    entries: incoming.entries.map((entry) => {
      const localEntry = localByType.get(entry.type);
      if (localEntry === undefined) {
        return entry;
      }

      return {
        maturity: pendingFieldVersions.has(`${entry.type}:maturity`)
          ? localEntry.maturity
          : entry.maturity,
        reviewIssues: entry.reviewIssues,
        reviews: pendingFieldVersions.has(`${entry.type}:reviews`)
          ? localEntry.reviews
          : entry.reviews,
        ...(entry.schemaDesign === undefined ? {} : { schemaDesign: entry.schemaDesign }),
        storage: pendingFieldVersions.has(`${entry.type}:storage`)
          ? localEntry.storage
          : entry.storage,
        storageTarget: pendingFieldVersions.has(`${entry.type}:storageTarget`)
          ? localEntry.storageTarget
          : entry.storageTarget,
        type: entry.type
      };
    })
  };
  loadState.value = 'ready';
  if (pendingFieldVersions.size === 0 && saveState.value !== 'error') {
    saveState.value = 'saved';
  }
}

function onTypeActivate(): void {
  setHoverKey(null);
  hideHoverPreview();
}
</script>

<template>
  <section class="storage-review">
    <header class="storage-review__toolbar">
      <label class="storage-review__filter">
        <span class="storage-review__filter-label">Filter</span>
        <input v-model="filterText" class="storage-review__filter-input" type="search" />
      </label>
      <span class="storage-review__status">{{ statusText }}</span>
    </header>

    <div class="storage-review__table-shell">
      <table class="storage-review__table">
        <colgroup>
          <col :style="{ width: typeColumnWidth }" class="storage-review__type-column" />
          <col class="storage-review__storage-column" />
          <col class="storage-review__target-column" />
        </colgroup>
        <thead class="storage-review__head">
          <tr class="storage-review__row">
            <th class="storage-review__type-heading" scope="col">
              <div class="storage-review__type-heading-content">
                Type
                <span class="storage-review__type-heading-count">
                  {{ visibleEntries.length }} / {{ entries.length }}
                </span>
              </div>
            </th>
            <th class="storage-review__storage-heading" scope="col">
              <div class="storage-review__storage-heading-content">
                <span class="storage-review__storage-heading-label">Storage</span>
                <div class="storage-review__maturity-heading-control">
                  <button
                    :aria-pressed="maturityFilter === 'all'"
                    :data-active="maturityFilter === 'all' ? 'true' : undefined"
                    class="storage-review__maturity-heading-button"
                    type="button"
                    @click="maturityFilter = 'all'"
                  >
                    All
                  </button>
                  <button
                    v-for="maturity in maturityLevels"
                    :key="maturity"
                    :aria-label="`Filter maturity ${String(maturity)}`"
                    :aria-pressed="maturityFilter === maturity"
                    :data-active="maturityFilter === maturity ? 'true' : undefined"
                    class="storage-review__maturity-heading-button"
                    type="button"
                    @click="maturityFilter = maturity"
                  >
                    {{ maturity }}
                  </button>
                </div>
              </div>
            </th>
            <th class="storage-review__target-heading" scope="col">
              <div class="storage-review__target-heading-content">Storage target</div>
            </th>
          </tr>
        </thead>
        <tbody class="storage-review__body">
          <template v-for="entry in visibleEntries" :key="entry.type">
            <tr class="storage-review__row">
              <td class="storage-review__type-cell">
                <div class="storage-review__type-content">
                  <div class="storage-review__type-link">
                    <EntityLink
                      :entity-id="entityIdForType(entry)"
                      :parent-instance-id="rowInstanceId(entry)"
                      :slot-key="rowSlot(entry)"
                      :text="entry.type"
                      @activate="onTypeActivate"
                    />
                  </div>
                  <StorageReviewButtons
                    :entry="entry"
                    :max-note-count="maxReviewNoteCount"
                    @toggle="toggleReviewCard(entry, $event)"
                  />
                </div>
              </td>
              <td class="storage-review__storage-cell">
                <div class="storage-review__storage-control">
                  <select
                    :value="entry.storage"
                    class="storage-review__storage-select"
                    @change="onStorageChange(entry, $event)"
                  >
                    <option value=""></option>
                    <option
                      v-for="storageOption in storageOptions"
                      :key="storageOption"
                      :value="storageOption"
                    >
                      {{ storageOption }}
                    </option>
                  </select>
                  <div class="storage-review__maturity-control">
                    <button
                      v-for="maturity in maturityLevels"
                      :key="maturity"
                      :aria-label="`Set maturity ${String(maturity)} for ${entry.type}`"
                      :aria-pressed="entry.maturity === maturity"
                      :data-active="entry.maturity === maturity ? 'true' : undefined"
                      class="storage-review__maturity-button"
                      type="button"
                      @click="onMaturityChange(entry, maturity)"
                    >
                      {{ maturity }}
                    </button>
                  </div>
                </div>
              </td>
              <td class="storage-review__target-cell">
                <input
                  :value="entry.storageTarget"
                  class="storage-review__target-input"
                  type="text"
                  @input="onStorageTargetInput(entry, $event)"
                />
              </td>
            </tr>
            <tr v-if="hasExpandedRow(entry)" class="storage-review__expanded-row">
              <td class="storage-review__expanded-cell" colspan="3">
                <div class="storage-review__expanded-content">
                  <EntityCard
                    v-for="child in rowCards(entry)"
                    :key="child.instanceId"
                    :depth="0"
                    :instance="child"
                  />
                  <StorageReviewInfoCard
                    v-for="reviewIndex in expandedReviewIndexes(entry)"
                    :key="storageReviewButtonKey(entry, reviewIndex)"
                    :compact="false"
                    :entry="entry"
                    :review-index="reviewIndex"
                    @close="closeReviewCard(entry, reviewIndex)"
                  />
                </div>
              </td>
            </tr>
          </template>
        </tbody>
      </table>
    </div>
  </section>
</template>

<style scoped>
@reference '../style.css';

.storage-review {
  @apply flex h-full min-h-0 flex-col bg-white text-neutral-950;
}

.storage-review__toolbar {
  @apply grid shrink-0 grid-cols-[minmax(220px,640px)_minmax(0,1fr)_minmax(84px,84px)] items-end gap-4 border-b border-neutral-200 bg-white px-3 py-2;
}

.storage-review__filter {
  @apply grid min-w-0 gap-1;
}

.storage-review__filter-label {
  @apply text-[11px] font-semibold uppercase leading-none text-neutral-500;
}

.storage-review__filter-input {
  @apply h-8 min-w-0 rounded border border-neutral-300 bg-white px-2 text-sm leading-none text-neutral-950 outline-none focus:border-sky-500;
}

.storage-review__status {
  @apply col-start-3 flex h-8 w-[84px] items-center justify-center rounded border border-neutral-200 text-xs font-semibold uppercase leading-none text-neutral-600;
}

.storage-review__table-shell {
  @apply min-h-0 flex-1 overflow-auto;
}

.storage-review__table {
  @apply w-full min-w-[980px] table-fixed border-separate border-spacing-0 text-left;
}

.storage-review__storage-column {
  @apply w-[260px];
}

.storage-review__head {
  @apply sticky top-0 z-10 bg-neutral-100;
}

.storage-review__row {
  @apply align-top;
}

.storage-review__type-heading {
  @apply whitespace-nowrap border-b border-r border-neutral-300 px-2 py-1.5 text-xs font-semibold uppercase text-neutral-600;
}

.storage-review__type-heading-content {
  @apply flex h-[22px] items-center gap-2;
}

.storage-review__type-heading-count {
  @apply font-mono text-[11px] font-medium normal-case text-neutral-400;
}

.storage-review__storage-heading {
  @apply border-b border-r border-neutral-300 px-2 py-1.5 text-xs font-semibold uppercase text-neutral-600;
}

.storage-review__storage-heading-content {
  @apply grid h-[22px] grid-cols-[minmax(0,1fr)_auto] items-center gap-1;
}

.storage-review__storage-heading-label {
  @apply min-w-0 flex-1;
}

.storage-review__target-heading {
  @apply border-b border-neutral-300 px-2 py-1.5 text-xs font-semibold uppercase text-neutral-600;
}

.storage-review__target-heading-content {
  @apply flex h-[22px] items-center;
}

.storage-review__body {
  @apply bg-white;
}

.storage-review__type-cell {
  @apply border-b border-r border-neutral-200 px-2 py-px;
}

.storage-review__type-content {
  @apply grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-2 whitespace-nowrap;
}

.storage-review__type-link {
  @apply min-w-0 overflow-hidden;
}

.storage-review__storage-cell {
  @apply border-b border-r border-neutral-200 px-2 py-px;
}

.storage-review__target-cell {
  @apply border-b border-neutral-200 px-2 py-px;
}

.storage-review__storage-select {
  @apply h-[22px] w-full box-border rounded border border-neutral-300 bg-white px-2 py-0 font-mono text-sm leading-none text-neutral-900 outline-none focus:border-sky-500;
}

.storage-review__storage-control {
  @apply flex items-center gap-1;
}

.storage-review__maturity-control {
  @apply flex shrink-0 items-center rounded border border-neutral-300 bg-white p-px;
}

.storage-review__maturity-heading-control {
  @apply flex shrink-0 items-center rounded border border-neutral-300 bg-white p-px;
}

.storage-review__maturity-heading-button {
  @apply flex h-[18px] min-w-[18px] items-center justify-center rounded border border-transparent px-1 font-mono text-[11px] font-semibold normal-case leading-none text-neutral-500 hover:text-neutral-950;
}

.storage-review__maturity-heading-button[data-active='true'] {
  @apply border-sky-300 bg-sky-50 text-sky-800;
}

.storage-review__maturity-button {
  @apply flex h-[18px] w-[18px] items-center justify-center rounded border border-transparent font-mono text-[11px] font-semibold leading-none text-neutral-500 hover:text-neutral-950;
}

.storage-review__maturity-button[data-active='true'] {
  @apply border-sky-300 bg-sky-50 text-sky-800;
}

.storage-review__target-input {
  @apply h-[22px] w-full box-border rounded border border-transparent bg-transparent px-2 py-0 font-mono text-sm leading-none text-neutral-900 outline-none hover:border-neutral-300 focus:border-sky-500 focus:bg-white;
}

.storage-review__expanded-row {
  @apply align-top;
}

.storage-review__expanded-cell {
  @apply border-b border-neutral-200 bg-neutral-50 px-2 py-2;
}

.storage-review__expanded-content {
  @apply flex max-w-5xl flex-col gap-2;
}

@media (max-width: 900px) {
  .storage-review__toolbar {
    @apply grid-cols-1 items-stretch;
  }

  .storage-review__status {
    @apply w-fit;
  }
}
</style>
