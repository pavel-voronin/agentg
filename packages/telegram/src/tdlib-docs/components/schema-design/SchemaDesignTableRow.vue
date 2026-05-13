<script setup lang="ts">
import { computed, watch } from 'vue';

import {
  schemaKvMappingsForTable,
  schemaTableColumnLabel,
  type SchemaDesignSourceFocusRequest,
  type SchemaDesignSourceHoverTarget,
  type SchemaDesignTableFocusRequest,
  type SchemaDesignTableFocusTarget,
  type SchemaDesignTableHoverTarget,
  type SchemaDesignUpdateFocusRequest
} from '../../schemaDesignView.js';
import type {
  StorageReviewEntry,
  StorageSchemaColumnLayout,
  StorageSchemaTable
} from '../../storageReviewTypes.js';
import SchemaDesignTableExpandedRow from './SchemaDesignTableExpandedRow.vue';
import SchemaDesignTableTag from './SchemaDesignTableTag.vue';

const props = defineProps<{
  detailExpanded: boolean;
  entries: StorageReviewEntry[];
  focusTarget: SchemaDesignTableFocusTarget | null;
  sourceHoverTarget: SchemaDesignSourceHoverTarget | null;
  table: StorageSchemaTable;
  tableHoverTarget: SchemaDesignTableHoverTarget | null;
}>();

const emit = defineEmits<{
  columnLayoutChange: [columnLayout: StorageSchemaColumnLayout];
  detailExpandedChange: [expanded: boolean];
  sourceFocus: [target: SchemaDesignSourceFocusRequest];
  sourceHover: [target: SchemaDesignSourceHoverTarget | null];
  tableFocus: [target: SchemaDesignTableFocusRequest];
  tableHover: [target: SchemaDesignTableHoverTarget | null];
  updateFocus: [target: SchemaDesignUpdateFocusRequest];
}>();

const kvMappings = computed(() => schemaKvMappingsForTable(props.entries, props.table.name));

function toggleDetail(): void {
  emit('detailExpandedChange', !props.detailExpanded);
}

watch(
  () => props.focusTarget?.id,
  () => {
    if (props.focusTarget?.table === props.table.name) {
      emit('detailExpandedChange', true);
    }
  },
  { immediate: true }
);
</script>

<template>
  <tr :data-schema-table-row="table.name" class="schema-design-table-row">
    <td class="schema-design-table-row__cell">
      <div class="schema-design-table-row__content">
        <div class="schema-design-table-row__primary">
          <SchemaDesignTableTag :expanded="detailExpanded" :table="table" @toggle="toggleDetail" />
          <span class="schema-design-table-row__count">{{ schemaTableColumnLabel(table) }}</span>
        </div>
      </div>
    </td>
  </tr>
  <SchemaDesignTableExpandedRow
    v-if="detailExpanded"
    :focus-target="focusTarget"
    :column-layout="table.columnLayout ?? 'grid'"
    :kv-mappings="kvMappings"
    :source-hover-target="sourceHoverTarget"
    :table="table"
    :table-hover-target="tableHoverTarget"
    @column-layout-change="emit('columnLayoutChange', $event)"
    @source-focus="emit('sourceFocus', $event)"
    @source-hover="emit('sourceHover', $event)"
    @table-focus="emit('tableFocus', $event)"
    @table-hover="emit('tableHover', $event)"
    @update-focus="emit('updateFocus', $event)"
  />
</template>

<style scoped>
@reference '../../style.css';

.schema-design-table-row {
  @apply align-top;
}

.schema-design-table-row__cell {
  @apply border-b border-neutral-200 px-2 py-px;
}

.schema-design-table-row__content {
  @apply grid min-w-0 grid-cols-[minmax(0,1fr)] items-center whitespace-nowrap;
}

.schema-design-table-row__primary {
  @apply flex min-w-0 items-center gap-1.5 overflow-hidden;
}

.schema-design-table-row__count {
  @apply shrink-0 font-mono text-[10px] leading-none text-neutral-400;
}
</style>
