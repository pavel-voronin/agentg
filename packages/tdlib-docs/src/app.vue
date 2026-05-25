<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, useTemplateRef, watch } from 'vue';

import EntityCard from './components/entityCard.vue';
import EntityPopover from './components/entityPopover.vue';
import SearchPanel from './components/searchPanel.vue';
import SchemaDesignPage from './components/schema-design/schemaDesignPage.vue';
import StorageReviewPage from './components/storageReviewPage.vue';
import {
  activeColumnId,
  columns,
  columnScrollTops,
  hasMultipleColumns,
  selectColumn,
  setColumnScrollTop,
  setWorkspaceScrollLeft,
  workspaceScrollLeft
} from './explorerState.js';

type DocsPage = 'explorer' | 'schema-design' | 'storage-review';

const workspaceElement = useTemplateRef<HTMLElement>('workspace');
const currentPage = ref<DocsPage>(readCurrentPage());

watch(activeColumnId, (columnId) => {
  void scrollColumnIntoView(columnId);
});

async function scrollColumnIntoView(columnId: string): Promise<void> {
  await nextTick();
  const workspace = workspaceElement.value;
  const column = workspace?.querySelector<HTMLElement>(`[data-column-id="${columnId}"]`);
  column?.scrollIntoView({
    behavior: 'smooth',
    block: 'nearest',
    inline: 'nearest'
  });
}

onMounted(() => {
  void restoreScrollPositions();
  window.addEventListener('popstate', syncCurrentPage);
  window.addEventListener('hashchange', syncCurrentPage);
});

onBeforeUnmount(() => {
  window.removeEventListener('popstate', syncCurrentPage);
  window.removeEventListener('hashchange', syncCurrentPage);
});

async function restoreScrollPositions(): Promise<void> {
  await nextTick();
  const workspace = workspaceElement.value;
  if (workspace === null) {
    return;
  }

  workspace.scrollLeft = workspaceScrollLeft.value;
  for (const column of columns.value) {
    const element = workspace.querySelector<HTMLElement>(`[data-column-id="${column.columnId}"]`);
    if (element !== null) {
      element.scrollTop = columnScrollTops.value.get(column.columnId) ?? 0;
    }
  }
}

function onWorkspaceScroll(event: Event): void {
  const target = event.currentTarget;
  if (target instanceof HTMLElement) {
    setWorkspaceScrollLeft(target.scrollLeft);
  }
}

function onColumnScroll(columnId: string, event: Event): void {
  const target = event.currentTarget;
  if (target instanceof HTMLElement) {
    setColumnScrollTop(columnId, target.scrollTop);
  }
}

function navigateTo(page: DocsPage): void {
  const nextPath =
    page === 'storage-review'
      ? storageReviewPath()
      : page === 'schema-design'
        ? schemaDesignPath()
        : explorerPath();
  window.history.pushState({}, '', nextPath);
  currentPage.value = page;
}

function syncCurrentPage(): void {
  currentPage.value = readCurrentPage();
}

function readCurrentPage(): DocsPage {
  if (
    window.location.pathname.endsWith('/storage-review') ||
    window.location.hash === '#storage-review'
  ) {
    return 'storage-review';
  }
  if (
    window.location.pathname.endsWith('/schema-design') ||
    window.location.hash === '#schema-design'
  ) {
    return 'schema-design';
  }
  return 'explorer';
}

function docsBasePath(): string {
  return window.location.pathname.replace(/\/(?:schema-design|storage-review)\/?$/, '/');
}

function explorerPath(): string {
  return docsBasePath();
}

function storageReviewPath(): string {
  return `${docsBasePath().replace(/\/$/, '')}/storage-review`;
}

function schemaDesignPath(): string {
  return `${docsBasePath().replace(/\/$/, '')}/schema-design`;
}
</script>

<template>
  <main class="app-shell">
    <header class="app-shell__header">
      <div class="app-shell__top-row">
        <nav class="app-shell__nav">
          <button
            :data-active="currentPage === 'explorer' ? 'true' : undefined"
            class="app-shell__nav-button"
            type="button"
            @click="navigateTo('explorer')"
          >
            Explorer
          </button>
          <button
            :data-active="currentPage === 'storage-review' ? 'true' : undefined"
            class="app-shell__nav-button"
            type="button"
            @click="navigateTo('storage-review')"
          >
            Storage
          </button>
          <button
            :data-active="currentPage === 'schema-design' ? 'true' : undefined"
            class="app-shell__nav-button"
            type="button"
            @click="navigateTo('schema-design')"
          >
            Tables
          </button>
        </nav>
        <div id="schema-design-header-actions" class="app-shell__schema-actions"></div>
      </div>
      <SearchPanel v-if="currentPage === 'explorer'" />
    </header>

    <section
      v-if="currentPage === 'explorer'"
      ref="workspace"
      class="app-shell__workspace"
      aria-label="TDLib card columns"
      @scroll="onWorkspaceScroll"
    >
      <div class="app-shell__columns">
        <div
          v-for="column in columns"
          :key="column.columnId"
          :data-active="
            hasMultipleColumns && activeColumnId === column.columnId ? 'true' : undefined
          "
          :data-column-id="column.columnId"
          class="app-shell__column"
          @click="selectColumn(column.columnId)"
          @scroll="onColumnScroll(column.columnId, $event)"
        >
          <div class="app-shell__column-marker"></div>
          <EntityCard
            v-if="column.card !== undefined"
            :key="column.card.instanceId"
            :depth="0"
            :instance="column.card"
          />
        </div>
      </div>
    </section>

    <StorageReviewPage v-else-if="currentPage === 'storage-review'" />
    <SchemaDesignPage v-else />

    <EntityPopover />
  </main>
</template>

<style scoped>
@reference './style.css';

:global(html),
:global(body),
:global(#app) {
  @apply h-full;
}

:global(body) {
  @apply m-0 overflow-hidden bg-white font-sans text-neutral-950;
}

:global(button),
:global(input) {
  @apply font-sans;
}

:global(button) {
  @apply appearance-none bg-transparent text-inherit;
}

.app-shell {
  @apply flex h-screen flex-col overflow-hidden bg-white text-neutral-950;
}

.app-shell__header {
  @apply z-30 shrink-0 bg-white px-2.5 pb-1 pt-2;
}

.app-shell__top-row {
  @apply mb-1 flex items-start gap-2;
}

.app-shell__nav {
  @apply flex shrink-0 gap-1;
}

.app-shell__nav-button {
  @apply rounded border border-neutral-300 bg-white px-2 py-1 text-xs font-semibold uppercase leading-none text-neutral-600 hover:border-neutral-500 hover:text-neutral-950;
}

.app-shell__nav-button[data-active='true'] {
  @apply border-sky-500 bg-sky-50 text-sky-900;
}

.app-shell__schema-actions {
  @apply ml-auto flex min-w-0 items-center gap-2;
}

.app-shell__workspace {
  @apply min-h-0 min-w-0 flex-1 overflow-x-auto overflow-y-hidden p-0.5;
}

.app-shell__columns {
  @apply flex h-full min-w-full items-stretch gap-1;
}

.app-shell__column {
  @apply relative box-border h-full min-w-[520px] flex-1 overflow-y-auto bg-white px-2 pb-2 pt-2.5;
}

.app-shell__column-marker {
  @apply absolute left-2 right-2 top-0 h-1 bg-transparent;
}

.app-shell__column[data-active='true'] .app-shell__column-marker {
  @apply bg-sky-200;
}
</style>
