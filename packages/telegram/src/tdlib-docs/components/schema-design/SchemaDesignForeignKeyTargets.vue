<script setup lang="ts">
import { computed } from 'vue';

import type {
  SchemaDesignTableFocusRequest,
  SchemaDesignTableHoverTarget
} from '../../schemaDesignView.js';
import type { StorageSchemaForeignKey } from '../../storageReviewTypes.js';

type ForeignKeyTarget = {
  columns: string[];
  id: string;
  table: string;
};

const props = defineProps<{
  foreignKeys: StorageSchemaForeignKey[];
}>();

const emit = defineEmits<{
  tableFocus: [target: SchemaDesignTableFocusRequest];
  tableHover: [target: SchemaDesignTableHoverTarget | null];
}>();

const targets = computed<ForeignKeyTarget[]>(() =>
  props.foreignKeys.map((foreignKey) => ({
    columns: foreignKey.referencedColumns.map((columnId) =>
      referencedColumnName(foreignKey.referencedTable, columnId)
    ),
    id: foreignKey.id,
    table: foreignKey.referencedTable
  }))
);

function referencedColumnName(tableName: string, columnId: string): string {
  const prefix = `${tableName}.`;
  if (columnId.startsWith(prefix)) {
    return columnId.slice(prefix.length);
  }

  return columnId;
}

function onTableClick(target: ForeignKeyTarget): void {
  emit('tableFocus', { table: target.table });
}

function onColumnClick(target: ForeignKeyTarget, column: string): void {
  emit('tableFocus', { column, table: target.table });
}

function onTableMouseEnter(target: ForeignKeyTarget): void {
  emit('tableHover', { table: target.table });
}

function onColumnMouseEnter(target: ForeignKeyTarget, column: string): void {
  emit('tableHover', { column, table: target.table });
}

function onMouseLeave(): void {
  emit('tableHover', null);
}
</script>

<template>
  <span class="schema-design-foreign-key-targets">
    <span
      v-for="target in targets"
      :key="target.id"
      class="schema-design-foreign-key-targets__target"
    >
      <span class="schema-design-foreign-key-targets__arrow">→</span>
      <button
        class="schema-design-foreign-key-targets__table-link"
        type="button"
        @click="onTableClick(target)"
        @mouseenter="onTableMouseEnter(target)"
        @mouseleave="onMouseLeave"
      >
        {{ target.table }}
      </button>
      <span class="schema-design-foreign-key-targets__paren">(</span>
      <template v-for="(column, index) in target.columns" :key="`${target.id}:${column}`">
        <span v-if="index > 0" class="schema-design-foreign-key-targets__comma">,</span>
        <button
          class="schema-design-foreign-key-targets__column-link"
          type="button"
          @click="onColumnClick(target, column)"
          @mouseenter="onColumnMouseEnter(target, column)"
          @mouseleave="onMouseLeave"
        >
          {{ column }}
        </button>
      </template>
      <span class="schema-design-foreign-key-targets__paren">)</span>
    </span>
  </span>
</template>

<style scoped>
@reference '../../style.css';

.schema-design-foreign-key-targets {
  @apply inline-flex min-w-0 max-w-full flex-col gap-0.5 align-baseline;
}

.schema-design-foreign-key-targets__target {
  @apply inline-flex max-w-full min-w-0 flex-wrap items-baseline gap-x-0.5;
}

.schema-design-foreign-key-targets__arrow {
  @apply font-mono text-[0.92em] leading-snug text-neutral-400;
}

.schema-design-foreign-key-targets__table-link {
  @apply inline-flex max-w-full appearance-none items-center overflow-hidden text-ellipsis whitespace-nowrap rounded border border-l-2 border-neutral-200 border-l-rose-500 bg-white px-1 py-0 text-left font-mono text-[0.92em] leading-snug text-rose-700 outline-none hover:border-neutral-300 hover:bg-rose-50 hover:text-rose-900;
}

.schema-design-foreign-key-targets__paren {
  @apply font-mono text-[0.92em] leading-snug text-neutral-400;
}

.schema-design-foreign-key-targets__comma {
  @apply font-mono text-[0.92em] leading-snug text-neutral-400;
}

.schema-design-foreign-key-targets__column-link {
  @apply inline-flex max-w-full appearance-none items-center overflow-hidden text-ellipsis whitespace-nowrap rounded border border-l-2 border-neutral-200 border-l-neutral-400 bg-white px-1 py-0 text-left font-mono text-[0.92em] leading-snug text-neutral-600 outline-none hover:border-neutral-300 hover:bg-neutral-50 hover:text-neutral-950;
}
</style>
