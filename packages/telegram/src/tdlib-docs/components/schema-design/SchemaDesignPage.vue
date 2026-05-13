<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';

import { closeInlineCardsByParentPrefix } from '../../explorerState.js';
import { storageReviewButtonKey, storageReviewButtons } from '../../storageReviewDisplay.js';
import {
  fetchStorageReviewState,
  onStorageReviewStateUpdate,
  updateStorageSchemaTable
} from '../../storageReviewClient.js';
import {
  schemaUpdateMatchesQuery,
  schemaEntryMatchesQuery,
  schemaTableMatchesQuery,
  type SchemaDesignLeftPane,
  type SchemaDesignSourceFocusRequest,
  type SchemaDesignSourceFocusTarget,
  type SchemaDesignSourceHoverTarget,
  type SchemaDesignTableFocusRequest,
  type SchemaDesignTableFocusTarget,
  type SchemaDesignTableHoverTarget,
  type SchemaDesignUpdateFocusRequest,
  type SchemaDesignUpdateFocusTarget
} from '../../schemaDesignView.js';
import {
  persistSchemaDesignViewState,
  readSchemaDesignViewState
} from '../../schemaDesignViewState.js';
import { updateEntities } from '../../schemaIndex.js';
import type {
  StorageSchemaColumnLayout,
  StorageReviewState,
  StorageSchemaTablePatch
} from '../../storageReviewTypes.js';
import SchemaDesignSplitView from './SchemaDesignSplitView.vue';
import SchemaDesignToolbar from './SchemaDesignToolbar.vue';

const restoredViewState = readSchemaDesignViewState();
const reviewState = ref<StorageReviewState | null>(null);
const filterText = ref(restoredViewState.filterText);
const expandedReviewKeys = ref<Set<string>>(new Set(restoredViewState.expandedReviewKeys));
const expandedTableNames = ref<Set<string>>(new Set(restoredViewState.expandedTableNames));
const expandedTypeNames = ref<Set<string>>(new Set(restoredViewState.expandedTypeNames));
const expandedUpdateNames = ref<Set<string>>(new Set(restoredViewState.expandedUpdateNames));
const updateFieldLayout = ref(restoredViewState.updateFieldLayout);
const activeLeftPane = ref<SchemaDesignLeftPane>(restoredViewState.leftPane);
const loadState = ref<'error' | 'loading' | 'ready'>('loading');
const saveState = ref<'error' | 'ready' | 'saving'>('ready');
const sourceFocusTarget = ref<SchemaDesignSourceFocusTarget | null>(null);
const sourceHoverTarget = ref<SchemaDesignSourceHoverTarget | null>(null);
const tableFocusTarget = ref<SchemaDesignTableFocusTarget | null>(null);
const tableHoverTarget = ref<SchemaDesignTableHoverTarget | null>(null);
const updateFocusTarget = ref<SchemaDesignUpdateFocusTarget | null>(null);
const tableScrollTop = ref(restoredViewState.tableScrollTop);
const typeScrollTop = ref(restoredViewState.typeScrollTop);
const updateScrollTop = ref(restoredViewState.updateScrollTop);
const pendingTableFieldVersions = new Map<string, number>();
let editVersion = 0;
let sourceFocusId = 0;
let tableFocusId = 0;
let updateFocusId = 0;
let saveQueue = Promise.resolve();

const entries = computed(() => reviewState.value?.entries ?? []);
const tables = computed(() => reviewState.value?.tables ?? []);
const updateDesigns = computed(() => reviewState.value?.updateDesigns ?? {});
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
const visibleEntries = computed(() =>
  entries.value.filter(
    (entry) =>
      entry.type === sourceFocusTarget.value?.type ||
      schemaEntryMatchesQuery(entry, filterText.value)
  )
);
const visibleTables = computed(() =>
  tables.value.filter(
    (table) =>
      table.name === tableFocusTarget.value?.table ||
      schemaTableMatchesQuery(table, filterText.value, entries.value)
  )
);
const visibleUpdates = computed(() =>
  updateEntities.filter(
    (update) =>
      update.name === updateFocusTarget.value?.update ||
      schemaUpdateMatchesQuery(update, filterText.value)
  )
);
const statusState = computed<'error' | 'loading' | 'ready' | 'saving'>(() => {
  if (loadState.value === 'loading') {
    return 'loading';
  }
  if (loadState.value === 'error' || saveState.value === 'error') {
    return 'error';
  }
  if (saveState.value === 'saving') {
    return 'saving';
  }

  return 'ready';
});
const statusText = computed(() => {
  if (loadState.value === 'loading') {
    return 'Loading';
  }
  if (loadState.value === 'error') {
    return 'Error';
  }
  if (saveState.value === 'error') {
    return 'Error';
  }
  if (saveState.value === 'saving') {
    return 'Saving';
  }

  return 'Ready';
});

watch(
  [
    filterText,
    expandedReviewKeys,
    expandedTableNames,
    expandedTypeNames,
    expandedUpdateNames,
    updateFieldLayout,
    activeLeftPane,
    tableScrollTop,
    typeScrollTop,
    updateScrollTop
  ],
  () => {
    persistSchemaDesignViewState({
      expandedReviewKeys: [...expandedReviewKeys.value],
      expandedTableNames: [...expandedTableNames.value],
      expandedTypeNames: [...expandedTypeNames.value],
      expandedUpdateNames: [...expandedUpdateNames.value],
      filterText: filterText.value,
      leftPane: activeLeftPane.value,
      tableScrollTop: tableScrollTop.value,
      typeScrollTop: typeScrollTop.value,
      updateFieldLayout: updateFieldLayout.value,
      updateScrollTop: updateScrollTop.value,
      version: 1
    });
  }
);

onMounted(() => {
  void loadReviewState();
  onStorageReviewStateUpdate((state) => {
    mergeStorageReviewState(state);
  });
});

async function loadReviewState(): Promise<void> {
  try {
    mergeStorageReviewState(await fetchStorageReviewState());
  } catch {
    loadState.value = 'error';
  }
}

function onTableColumnLayoutChange(
  tableName: string,
  columnLayout: StorageSchemaColumnLayout
): void {
  setTableValue(tableName, { columnLayout });
}

function onSourceFocus(target: SchemaDesignSourceFocusRequest): void {
  activeLeftPane.value = 'types';
  setTypeExpanded(target.type, true);
  sourceFocusTarget.value = {
    ...target,
    id: ++sourceFocusId
  };
}

function onTableFocus(target: SchemaDesignTableFocusRequest): void {
  setTableExpanded(target.table, true);
  tableFocusTarget.value = {
    ...target,
    id: ++tableFocusId
  };
}

function onUpdateFocus(target: SchemaDesignUpdateFocusRequest): void {
  activeLeftPane.value = 'updates';
  setUpdateExpanded(target.update, true);
  updateFocusTarget.value = {
    ...target,
    id: ++updateFocusId
  };
}

function onSourceHover(target: SchemaDesignSourceHoverTarget | null): void {
  sourceHoverTarget.value = target;
}

function onTableHover(target: SchemaDesignTableHoverTarget | null): void {
  tableHoverTarget.value = target;
}

function setTypeExpanded(typeName: string, expanded: boolean): void {
  expandedTypeNames.value = setMembership(expandedTypeNames.value, typeName, expanded);
}

function setTableExpanded(tableName: string, expanded: boolean): void {
  expandedTableNames.value = setMembership(expandedTableNames.value, tableName, expanded);
}

function setUpdateExpanded(updateName: string, expanded: boolean): void {
  expandedUpdateNames.value = setMembership(expandedUpdateNames.value, updateName, expanded);
}

function toggleTypeReviewCard(typeName: string, reviewIndex: number): void {
  const reviewKey = storageReviewButtonKey({ type: typeName }, reviewIndex);
  const next = new Set(expandedReviewKeys.value);
  if (next.has(reviewKey)) {
    next.delete(reviewKey);
  } else {
    next.add(reviewKey);
    setTypeExpanded(typeName, true);
  }
  expandedReviewKeys.value = next;
}

function closeTypeReviewCard(typeName: string, reviewIndex: number): void {
  const reviewKey = storageReviewButtonKey({ type: typeName }, reviewIndex);
  const next = new Set(expandedReviewKeys.value);
  next.delete(reviewKey);
  expandedReviewKeys.value = next;
}

function onTypeScrollChange(scrollTop: number): void {
  typeScrollTop.value = scrollTop;
}

function onTableScrollChange(scrollTop: number): void {
  tableScrollTop.value = scrollTop;
}

function onUpdateScrollChange(scrollTop: number): void {
  updateScrollTop.value = scrollTop;
}

function onActiveLeftPaneChange(pane: SchemaDesignLeftPane): void {
  activeLeftPane.value = pane;
  updateFocusTarget.value = null;
}

function closeAllSchemaDesignCards(): void {
  expandedReviewKeys.value = new Set();
  expandedTableNames.value = new Set();
  expandedTypeNames.value = new Set();
  expandedUpdateNames.value = new Set();
  sourceFocusTarget.value = null;
  sourceHoverTarget.value = null;
  tableFocusTarget.value = null;
  tableHoverTarget.value = null;
  updateFocusTarget.value = null;
  closeInlineCardsByParentPrefix([
    'schema-constructor:',
    'schema-table-column:',
    'schema-table-detail:',
    'schema-type-detail:',
    'schema-update-process:',
    'schema-update:'
  ]);
}

function setTableValue(tableName: string, patch: StorageSchemaTablePatch): void {
  updateLocalTable(tableName, patch);
  const fieldKeys = Object.keys(patch).map((fieldName) => `${tableName}:${fieldName}`);
  const version = ++editVersion;
  for (const fieldKey of fieldKeys) {
    pendingTableFieldVersions.set(fieldKey, version);
  }

  saveState.value = 'saving';
  saveQueue = saveQueue.then(async () => {
    try {
      const state = await updateStorageSchemaTable(tableName, patch);
      for (const fieldKey of fieldKeys) {
        if (pendingTableFieldVersions.get(fieldKey) === version) {
          pendingTableFieldVersions.delete(fieldKey);
        }
      }
      mergeStorageReviewState(state);
      saveState.value = pendingTableFieldVersions.size > 0 ? 'saving' : 'ready';
    } catch {
      saveState.value = 'error';
    }
  });
}

function updateLocalTable(tableName: string, patch: StorageSchemaTablePatch): void {
  const current = reviewState.value;
  const currentTables = current?.tables;
  if (current === null || currentTables === undefined) {
    return;
  }

  reviewState.value = {
    ...current,
    tables: currentTables.map((table) =>
      table.name === tableName
        ? {
            ...table,
            ...patch
          }
        : table
    )
  };
}

function mergeStorageReviewState(incoming: StorageReviewState): void {
  const localTablesByName = new Map(tables.value.map((table) => [table.name, table]));
  reviewState.value = {
    ...incoming,
    ...(incoming.tables === undefined
      ? {}
      : {
          tables: incoming.tables.map((table) => {
            const localTable = localTablesByName.get(table.name);
            if (localTable === undefined) {
              return table;
            }

            return {
              ...table,
              columnLayout: pendingTableFieldVersions.has(`${table.name}:columnLayout`)
                ? localTable.columnLayout
                : table.columnLayout
            };
          })
        })
  };
  loadState.value = 'ready';
  if (pendingTableFieldVersions.size === 0 && saveState.value !== 'error') {
    saveState.value = 'ready';
  }
}

function setMembership(items: Set<string>, item: string, included: boolean): Set<string> {
  const next = new Set(items);
  if (included) {
    next.add(item);
  } else {
    next.delete(item);
  }

  return next;
}
</script>

<template>
  <section class="schema-design-page">
    <SchemaDesignToolbar
      v-model:filter-text="filterText"
      :active-pane="activeLeftPane"
      :status-state="statusState"
      :status-text="statusText"
      :type-count="entries.length"
      :update-count="updateEntities.length"
      @active-pane-change="onActiveLeftPaneChange"
      @close-all="closeAllSchemaDesignCards"
    />
    <SchemaDesignSplitView
      :active-left-pane="activeLeftPane"
      :all-entries="entries"
      :all-tables="tables"
      :entries="visibleEntries"
      :expanded-review-keys="expandedReviewKeys"
      :expanded-table-names="expandedTableNames"
      :expanded-type-names="expandedTypeNames"
      :expanded-update-names="expandedUpdateNames"
      :field-layout="updateFieldLayout"
      :focus-target="sourceFocusTarget"
      :max-review-note-count="maxReviewNoteCount"
      :source-hover-target="sourceHoverTarget"
      :tables="visibleTables"
      :table-focus-target="tableFocusTarget"
      :table-hover-target="tableHoverTarget"
      :table-scroll-top="tableScrollTop"
      :total-entry-count="entries.length"
      :total-table-count="tables.length"
      :total-update-count="updateEntities.length"
      :type-scroll-top="typeScrollTop"
      :update-focus-target="updateFocusTarget"
      :update-designs="updateDesigns"
      :updates="visibleUpdates"
      :update-scroll-top="updateScrollTop"
      @source-focus="onSourceFocus"
      @source-hover="onSourceHover"
      @table-focus="onTableFocus"
      @table-hover="onTableHover"
      @table-expanded-change="setTableExpanded"
      @table-column-layout-change="onTableColumnLayoutChange"
      @table-scroll-change="onTableScrollChange"
      @field-layout-change="updateFieldLayout = $event"
      @update-focus="onUpdateFocus"
      @update-expanded-change="setUpdateExpanded"
      @type-expanded-change="setTypeExpanded"
      @type-review-close="closeTypeReviewCard"
      @type-review-toggle="toggleTypeReviewCard"
      @type-scroll-change="onTypeScrollChange"
      @update-scroll-change="onUpdateScrollChange"
    />
  </section>
</template>

<style scoped>
@reference '../../style.css';

.schema-design-page {
  @apply flex h-full min-h-0 flex-col bg-white text-neutral-950;
}
</style>
