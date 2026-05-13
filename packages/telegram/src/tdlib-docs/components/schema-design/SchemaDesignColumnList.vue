<script setup lang="ts">
import type {
  SchemaDesignKvMapping,
  SchemaDesignSourceFocusRequest,
  SchemaDesignSourceHoverTarget,
  SchemaDesignTableFocusRequest,
  SchemaDesignTableFocusTarget,
  SchemaDesignTableHoverTarget,
  SchemaDesignUpdateFocusRequest
} from '../../schemaDesignView.js';
import type { StorageSchemaColumnLayout, StorageSchemaTable } from '../../storageReviewTypes.js';
import SchemaDesignColumnLayoutControl from './SchemaDesignColumnLayoutControl.vue';
import SchemaDesignColumnRow from './SchemaDesignColumnRow.vue';
import SchemaDesignColumnStackedRow from './SchemaDesignColumnStackedRow.vue';
import SchemaDesignTableDdl from './SchemaDesignTableDdl.vue';

const props = defineProps<{
  columnLayout: StorageSchemaColumnLayout;
  focusTarget: SchemaDesignTableFocusTarget | null;
  kvMappings: SchemaDesignKvMapping[];
  sourceHoverTarget: SchemaDesignSourceHoverTarget | null;
  table: StorageSchemaTable;
  tableHoverTarget: SchemaDesignTableHoverTarget | null;
}>();

const emit = defineEmits<{
  columnLayoutChange: [columnLayout: StorageSchemaColumnLayout];
  kvEntriesFocus: [];
  sourceFocus: [target: SchemaDesignSourceFocusRequest];
  sourceHover: [target: SchemaDesignSourceHoverTarget | null];
  tableFocus: [target: SchemaDesignTableFocusRequest];
  tableHover: [target: SchemaDesignTableHoverTarget | null];
  updateFocus: [target: SchemaDesignUpdateFocusRequest];
}>();

function foreignKeysForColumn(columnId: string): StorageSchemaTable['foreignKeys'] {
  return props.table.foreignKeys.filter((foreignKey) => foreignKey.columns.includes(columnId));
}
</script>

<template>
  <section class="schema-design-column-list">
    <div class="schema-design-column-list__header">
      <h4 class="schema-design-column-list__title">Columns</h4>
      <SchemaDesignColumnLayoutControl
        :column-layout="columnLayout"
        @change="emit('columnLayoutChange', $event)"
      />
    </div>
    <table
      v-if="table.columns.length > 0 && columnLayout === 'grid'"
      class="schema-design-column-list__table"
    >
      <colgroup class="schema-design-column-list__columns">
        <col class="schema-design-column-list__name-column" />
        <col class="schema-design-column-list__type-column" />
        <col class="schema-design-column-list__null-column" />
        <col class="schema-design-column-list__role-column" />
        <col class="schema-design-column-list__source-column" />
      </colgroup>
      <thead class="schema-design-column-list__head">
        <tr class="schema-design-column-list__head-row">
          <th aria-label="Column" class="schema-design-column-list__heading" scope="col"></th>
          <th class="schema-design-column-list__heading" scope="col">Type</th>
          <th class="schema-design-column-list__heading" scope="col">Null</th>
          <th class="schema-design-column-list__heading" scope="col">Role</th>
          <th class="schema-design-column-list__heading" scope="col">Source</th>
        </tr>
      </thead>
      <tbody class="schema-design-column-list__body">
        <SchemaDesignColumnRow
          v-for="column in table.columns"
          :key="column.id"
          :column="column"
          :focus-target="focusTarget"
          :foreign-keys="foreignKeysForColumn(column.id)"
          :kv-mappings="kvMappings"
          :source-hover-target="sourceHoverTarget"
          :table-name="table.name"
          :table-hover-target="tableHoverTarget"
          @kv-entries-focus="emit('kvEntriesFocus')"
          @source-focus="emit('sourceFocus', $event)"
          @source-hover="emit('sourceHover', $event)"
          @table-focus="emit('tableFocus', $event)"
          @table-hover="emit('tableHover', $event)"
          @update-focus="emit('updateFocus', $event)"
        />
      </tbody>
    </table>
    <SchemaDesignTableDdl v-else-if="columnLayout === 'ddl'" :table="table" />
    <div v-else-if="table.columns.length > 0" class="schema-design-column-list__stacked-rows">
      <SchemaDesignColumnStackedRow
        v-for="column in table.columns"
        :key="column.id"
        :column="column"
        :focus-target="focusTarget"
        :foreign-keys="foreignKeysForColumn(column.id)"
        :kv-mappings="kvMappings"
        :source-hover-target="sourceHoverTarget"
        :table-name="table.name"
        :table-hover-target="tableHoverTarget"
        @kv-entries-focus="emit('kvEntriesFocus')"
        @source-focus="emit('sourceFocus', $event)"
        @source-hover="emit('sourceHover', $event)"
        @table-focus="emit('tableFocus', $event)"
        @table-hover="emit('tableHover', $event)"
        @update-focus="emit('updateFocus', $event)"
      />
    </div>
    <p
      v-if="table.columns.length === 0 && columnLayout !== 'ddl'"
      class="schema-design-column-list__empty"
    >
      No columns
    </p>
  </section>
</template>

<style scoped>
@reference '../../style.css';

.schema-design-column-list {
  @apply mt-3;
}

.schema-design-column-list__header {
  @apply mb-1 flex items-center justify-between gap-2;
}

.schema-design-column-list__title {
  @apply m-0 text-[11px] font-semibold uppercase leading-none text-neutral-500;
}

.schema-design-column-list__table {
  @apply w-full table-fixed border-collapse text-left;
}

.schema-design-column-list__columns {
  @apply w-full;
}

.schema-design-column-list__name-column {
  @apply w-[24%];
}

.schema-design-column-list__type-column {
  @apply w-[4.5rem];
}

.schema-design-column-list__null-column {
  @apply w-[4.75rem];
}

.schema-design-column-list__role-column {
  @apply w-[9rem];
}

.schema-design-column-list__source-column {
  @apply w-auto;
}

.schema-design-column-list__head {
  @apply bg-neutral-50;
}

.schema-design-column-list__head-row {
  @apply border-b border-neutral-200 align-top;
}

.schema-design-column-list__heading {
  @apply px-1 py-1 text-[10px] font-semibold uppercase leading-none text-neutral-500;
}

.schema-design-column-list__body {
  @apply bg-white;
}

.schema-design-column-list__stacked-rows {
  @apply flex flex-col bg-white;
}

.schema-design-column-list__empty {
  @apply m-0 rounded border border-neutral-200 bg-neutral-50 p-2 text-xs text-neutral-500;
}
</style>
