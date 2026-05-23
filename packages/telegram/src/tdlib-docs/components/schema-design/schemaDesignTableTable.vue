<script setup lang="ts">
import { nextTick, ref, watch } from 'vue';

import type {
  SchemaDesignSourceFocusRequest,
  SchemaDesignSourceHoverTarget,
  SchemaDesignTableFocusRequest,
  SchemaDesignTableFocusTarget,
  SchemaDesignTableHoverTarget,
  SchemaDesignUpdateFocusRequest
} from '../../schemaDesignView.js';
import type {
  StorageReviewEntry,
  StorageSchemaColumnLayout,
  StorageSchemaTable
} from '../../storageReviewTypes.js';
import SchemaDesignScrollIndicator from './schemaDesignScrollIndicator.vue';
import SchemaDesignTableRow from './schemaDesignTableRow.vue';
import { useSchemaDesignScrollIndicator } from './schemaDesignScrollIndicator.js';

const props = defineProps<{
  entries: StorageReviewEntry[];
  expandedTableNames: Set<string>;
  focusTarget: SchemaDesignTableFocusTarget | null;
  scrollTop: number;
  sourceHoverTarget: SchemaDesignSourceHoverTarget | null;
  tables: StorageSchemaTable[];
  tableHoverTarget: SchemaDesignTableHoverTarget | null;
  totalTableCount: number;
}>();

const emit = defineEmits<{
  scrollChange: [scrollTop: number];
  sourceFocus: [target: SchemaDesignSourceFocusRequest];
  sourceHover: [target: SchemaDesignSourceHoverTarget | null];
  tableExpandedChange: [tableName: string, expanded: boolean];
  tableColumnLayoutChange: [tableName: string, columnLayout: StorageSchemaColumnLayout];
  tableFocus: [target: SchemaDesignTableFocusRequest];
  tableHover: [target: SchemaDesignTableHoverTarget | null];
  updateFocus: [target: SchemaDesignUpdateFocusRequest];
}>();

const shellElement = ref<HTMLElement | null>(null);
const { scrollIndicatorScrollable, scrollIndicatorStyle, updateScrollIndicator } =
  useSchemaDesignScrollIndicator(
    shellElement,
    '.schema-design-table-table__table',
    '.schema-design-table-table__head'
  );

watch(
  () => [props.scrollTop, props.tables.length] as const,
  async ([scrollTop]) => {
    await nextTick();
    if (shellElement.value !== null && shellElement.value.scrollTop !== scrollTop) {
      shellElement.value.scrollTop = scrollTop;
    }
    updateScrollIndicator();
  },
  { immediate: true }
);

watch(
  () => props.focusTarget?.id,
  async () => {
    if (props.focusTarget === null) {
      return;
    }

    await nextTick();
    await nextTick();
    scrollToFocusTarget(props.focusTarget);
  },
  { flush: 'post' }
);

function onScroll(event: Event): void {
  const target = event.currentTarget;
  if (target instanceof HTMLElement) {
    updateScrollIndicator(target);
    emit('scrollChange', Math.round(target.scrollTop));
  }
}

function scrollToFocusTarget(target: SchemaDesignTableFocusTarget): void {
  const shell = shellElement.value;
  if (shell === null) {
    return;
  }

  const tableElement = [...shell.querySelectorAll<HTMLElement>('[data-schema-table]')].find(
    (element) => element.dataset.schemaTable === target.table
  );
  const tableRowElement =
    [...shell.querySelectorAll<HTMLElement>('[data-schema-table-row]')].find(
      (element) => element.dataset.schemaTableRow === target.table
    ) ?? null;
  const targetElement =
    target.column === undefined
      ? tableRowElement
      : tableElement === undefined
        ? null
        : ([...tableElement.querySelectorAll<HTMLElement>('[data-schema-column]')].find(
            (element) => element.dataset.schemaColumn === target.column
          ) ?? null);
  if (targetElement === null) {
    return;
  }

  const shellRect = shell.getBoundingClientRect();
  const targetRect = targetElement.getBoundingClientRect();
  const targetOffset =
    target.column === undefined ? 28 : shell.clientHeight / 2 - targetRect.height / 2;
  const nextScrollTop = Math.max(
    0,
    Math.round(shell.scrollTop + targetRect.top - shellRect.top - targetOffset)
  );
  shell.scrollTop = nextScrollTop;
  updateScrollIndicator(shell);
  emit('scrollChange', nextScrollTop);
}
</script>

<template>
  <section class="schema-design-table-table">
    <div ref="shellElement" class="schema-design-table-table__shell" @scroll="onScroll">
      <table class="schema-design-table-table__table">
        <colgroup>
          <col class="schema-design-table-table__table-column" />
        </colgroup>
        <thead class="schema-design-table-table__head">
          <tr class="schema-design-table-table__row">
            <th class="schema-design-table-table__table-heading" scope="col">
              <div class="schema-design-table-table__table-heading-content">
                Tables
                <span class="schema-design-table-table__table-heading-count">
                  {{ tables.length }} / {{ totalTableCount }}
                </span>
              </div>
            </th>
          </tr>
        </thead>
        <tbody class="schema-design-table-table__body">
          <SchemaDesignTableRow
            v-for="table in tables"
            :key="table.name"
            :detail-expanded="expandedTableNames.has(table.name)"
            :entries="entries"
            :focus-target="focusTarget"
            :source-hover-target="sourceHoverTarget"
            :table="table"
            :table-hover-target="tableHoverTarget"
            @column-layout-change="emit('tableColumnLayoutChange', table.name, $event)"
            @detail-expanded-change="emit('tableExpandedChange', table.name, $event)"
            @source-focus="emit('sourceFocus', $event)"
            @source-hover="emit('sourceHover', $event)"
            @table-focus="emit('tableFocus', $event)"
            @table-hover="emit('tableHover', $event)"
            @update-focus="emit('updateFocus', $event)"
          />
        </tbody>
      </table>
    </div>
    <SchemaDesignScrollIndicator
      :indicator-style="scrollIndicatorStyle"
      :scrollable="scrollIndicatorScrollable"
    />
  </section>
</template>

<style scoped>
@reference '../../style.css';

.schema-design-table-table {
  @apply relative h-full min-h-0 overflow-hidden bg-white;
}

.schema-design-table-table__shell {
  @apply h-full min-h-0 overflow-x-auto overflow-y-scroll overscroll-none [-ms-overflow-style:none] [scrollbar-width:none];
}

.schema-design-table-table__shell::-webkit-scrollbar {
  @apply hidden;
}

.schema-design-table-table__table {
  @apply w-full table-fixed border-separate border-spacing-0 text-left;
}

.schema-design-table-table__table-column {
  @apply w-full;
}

.schema-design-table-table__head {
  @apply sticky top-0 z-10 bg-neutral-100;
}

.schema-design-table-table__row {
  @apply align-top;
}

.schema-design-table-table__table-heading {
  @apply whitespace-nowrap border-b border-neutral-300 px-2 py-1.5 text-xs font-semibold uppercase text-neutral-600;
}

.schema-design-table-table__table-heading-content {
  @apply flex h-[22px] items-center gap-2;
}

.schema-design-table-table__table-heading-count {
  @apply font-mono text-[11px] font-medium normal-case text-neutral-400;
}

.schema-design-table-table__body {
  @apply bg-white;
}
</style>
