<script setup lang="ts">
import { computed, ref, watch } from 'vue';

import {
  activeColumnIsEmpty,
  closeAllCards,
  favoriteEntityIds,
  hasOpenCards,
  hideHoverPreview,
  openInActiveColumn,
  openInNewColumn,
  searchQuery,
  setHoverKey
} from '../explorerState.js';
import { kindLabels, searchTdlib } from '../schemaIndex.js';
import type { SearchEntry } from '../types.js';
import FavoriteBar from './FavoriteBar.vue';

const activeIndex = ref(0);
const isDropdownOpen = ref(false);
const results = computed(() => searchTdlib(searchQuery.value));
const shouldShowDropdown = computed(
  () => isDropdownOpen.value && (results.value.length > 0 || favoriteEntityIds.value.length > 0)
);

watch(results, () => {
  activeIndex.value = 0;
});

function openEntry(entry: SearchEntry, event?: KeyboardEvent | MouseEvent): void {
  if (isColumnModifier(event) && !activeColumnIsEmpty.value) {
    openInNewColumn(entry.entityId, entry.fieldName);
  } else {
    openInActiveColumn(entry.entityId, entry.fieldName);
  }

  closeDropdown();
}

function isColumnModifier(event?: KeyboardEvent | MouseEvent): boolean {
  return event?.shiftKey === true || event?.metaKey === true || event?.ctrlKey === true;
}

function clearQuery(): void {
  searchQuery.value = '';
  openDropdown();
}

function clearInterface(): void {
  searchQuery.value = '';
  closeAllCards();
  setHoverKey(null);
  hideHoverPreview();
  activeIndex.value = 0;
  closeDropdown();
}

function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'ArrowDown') {
    event.preventDefault();
    openDropdown();
    activeIndex.value = Math.min(activeIndex.value + 1, Math.max(0, results.value.length - 1));
  }
  if (event.key === 'ArrowUp') {
    event.preventDefault();
    openDropdown();
    activeIndex.value = Math.max(0, activeIndex.value - 1);
  }
  if (event.key === 'Enter') {
    const entry = results.value[activeIndex.value];
    if (entry !== undefined && shouldShowDropdown.value) {
      event.preventDefault();
      openEntry(entry, event);
    }
  }
}

function onSearchInputClick(event: MouseEvent): void {
  openDropdown();
  if (event.currentTarget instanceof HTMLInputElement) {
    event.currentTarget.select();
  }
}

function openDropdown(): void {
  isDropdownOpen.value = true;
}

function closeDropdown(): void {
  isDropdownOpen.value = false;
}

type HighlightSegment = {
  highlighted: boolean;
  key: string;
  text: string;
};

function highlightedSegments(value: string): HighlightSegment[] {
  const query = searchQuery.value.trim();
  const indexes = highlightedIndexes(value, query);
  const segments: HighlightSegment[] = [];
  let currentText = '';
  let currentHighlighted = false;

  for (let index = 0; index < value.length; index += 1) {
    const highlighted = indexes.has(index);
    if (currentText.length > 0 && highlighted !== currentHighlighted) {
      segments.push({
        highlighted: currentHighlighted,
        key: `${String(segments.length)}:${currentText}`,
        text: currentText
      });
      currentText = '';
    }

    currentHighlighted = highlighted;
    currentText += value[index] ?? '';
  }

  if (currentText.length > 0) {
    segments.push({
      highlighted: currentHighlighted,
      key: `${String(segments.length)}:${currentText}`,
      text: currentText
    });
  }

  return segments.length > 0 ? segments : [{ highlighted: false, key: 'empty', text: value }];
}

function highlightedIndexes(value: string, query: string): Set<number> {
  const indexes = new Set<number>();
  const needle = query.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (needle.length === 0) {
    return indexes;
  }

  let cursor = 0;
  for (let index = 0; index < value.length && cursor < needle.length; index += 1) {
    const char = value[index];
    if (char === undefined || !/[a-z0-9]/i.test(char)) {
      continue;
    }

    if (char.toLowerCase() === needle[cursor]) {
      indexes.add(index);
      cursor += 1;
    }
  }

  return cursor === needle.length ? indexes : new Set<number>();
}
</script>

<template>
  <section class="search-panel">
    <div class="search-panel__input-row">
      <div class="search-panel__input-box">
        <input
          id="tdlib-search"
          v-model="searchQuery"
          aria-label="TDLib search"
          autocomplete="off"
          class="search-panel__input"
          placeholder="message text entity, getChat, uNM..."
          type="search"
          @blur="closeDropdown"
          @click="onSearchInputClick"
          @focus="openDropdown"
          @input="openDropdown"
          @keydown="onKeydown"
        />
        <span
          v-if="favoriteEntityIds.length > 0"
          :data-has-clear="searchQuery.length > 0 ? 'true' : undefined"
          class="search-panel__favorite-count"
        >
          {{ favoriteEntityIds.length }} favorite(s)
        </span>
        <button
          v-if="searchQuery.length > 0"
          aria-label="Clear search field"
          class="search-panel__input-clear"
          title="Clear search field"
          type="button"
          @mousedown.prevent
          @click="clearQuery"
        >
          ×
        </button>
      </div>
      <button
        :disabled="searchQuery.length === 0 && !hasOpenCards"
        class="search-panel__clear"
        type="button"
        @click="clearInterface"
      >
        Clear
      </button>
    </div>

    <div v-if="shouldShowDropdown" class="search-panel__results">
      <FavoriteBar @activate="closeDropdown" />
      <div v-if="results.length > 0" class="search-panel__result-list" role="listbox">
        <button
          v-for="(entry, index) in results"
          :key="entry.id"
          :aria-selected="index === activeIndex"
          class="search-panel__result"
          role="option"
          type="button"
          @mousedown.prevent="openEntry(entry, $event)"
          @mouseenter="activeIndex = index"
        >
          <span class="search-panel__result-kind">{{ kindLabels[entry.kind] }}</span>
          <span class="search-panel__result-name">
            <span
              v-for="segment in highlightedSegments(entry.label)"
              :key="segment.key"
              :data-highlighted="segment.highlighted ? 'true' : undefined"
              class="search-panel__highlight-segment"
            >
              {{ segment.text }}
            </span>
          </span>
          <span v-if="entry.ownerName !== undefined" class="search-panel__result-owner">
            {{ entry.ownerName }}
          </span>
          <span class="search-panel__result-summary">{{ entry.summary }}</span>
        </button>
      </div>
    </div>
  </section>
</template>

<style scoped>
@reference '../style.css';

.search-panel {
  @apply relative flex flex-col gap-1.5;
}

.search-panel__input-row {
  @apply flex gap-1.5;
}

.search-panel__input-box {
  @apply relative flex min-w-0 flex-1;
}

.search-panel__input {
  @apply h-8 min-w-0 flex-1 appearance-none rounded border border-neutral-300 bg-white px-2.5 pr-20 text-sm text-neutral-950 outline-none placeholder:text-neutral-400 focus:border-neutral-700;
}

.search-panel__input::-webkit-search-cancel-button {
  @apply hidden;
}

.search-panel__input-clear {
  @apply absolute right-1 top-1/2 h-6 w-6 -translate-y-1/2 rounded border-0 text-base leading-none text-neutral-400 outline-none hover:bg-neutral-100 hover:text-neutral-900 focus:outline-none focus-visible:bg-neutral-100 focus-visible:text-neutral-900;
}

.search-panel__favorite-count {
  @apply pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-xs font-semibold leading-none text-neutral-400;
}

.search-panel__favorite-count[data-has-clear='true'] {
  @apply right-8;
}

.search-panel__clear {
  @apply h-8 rounded border border-neutral-300 bg-white px-2.5 text-sm text-neutral-700 hover:border-neutral-500 hover:text-neutral-950 disabled:cursor-not-allowed disabled:border-neutral-200 disabled:text-neutral-300;
}

.search-panel__results {
  @apply absolute left-0 right-0 top-9 z-50 flex max-h-[52vh] flex-col overflow-y-auto rounded border border-neutral-300 bg-white shadow-lg;
}

.search-panel__result {
  @apply grid h-8 w-full grid-cols-[108px_minmax(148px,280px)_minmax(100px,220px)_minmax(0,1fr)] items-center gap-x-2 border-b border-neutral-100 bg-white px-2 text-left text-sm text-neutral-900 last:border-b-0 hover:bg-neutral-50;
}

.search-panel__result-list {
  @apply w-full min-w-0;
}

.search-panel__result[aria-selected='true'] {
  @apply bg-yellow-50;
}

.search-panel__result-kind {
  @apply whitespace-nowrap text-xs uppercase text-neutral-500;
}

.search-panel__result-name {
  @apply min-w-0 truncate font-mono text-sm text-neutral-950;
}

.search-panel__result-owner {
  @apply min-w-0 truncate font-mono text-xs text-neutral-500;
}

.search-panel__result-summary {
  @apply min-w-0 truncate text-xs text-neutral-500;
}

.search-panel__highlight-segment[data-highlighted='true'] {
  @apply bg-yellow-200 text-neutral-950;
}

@media (max-width: 900px) {
  .search-panel__result {
    @apply grid-cols-[108px_minmax(120px,1fr)_minmax(0,1fr)];
  }

  .search-panel__result-summary {
    @apply hidden;
  }
}
</style>
