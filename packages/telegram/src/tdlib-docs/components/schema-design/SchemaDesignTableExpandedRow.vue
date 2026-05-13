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
import SchemaDesignTableDetailCard from './SchemaDesignTableDetailCard.vue';

defineProps<{
  columnLayout: StorageSchemaColumnLayout;
  focusTarget: SchemaDesignTableFocusTarget | null;
  kvMappings: SchemaDesignKvMapping[];
  sourceHoverTarget: SchemaDesignSourceHoverTarget | null;
  table: StorageSchemaTable;
  tableHoverTarget: SchemaDesignTableHoverTarget | null;
}>();

const emit = defineEmits<{
  columnLayoutChange: [columnLayout: StorageSchemaColumnLayout];
  sourceFocus: [target: SchemaDesignSourceFocusRequest];
  sourceHover: [target: SchemaDesignSourceHoverTarget | null];
  tableFocus: [target: SchemaDesignTableFocusRequest];
  tableHover: [target: SchemaDesignTableHoverTarget | null];
  updateFocus: [target: SchemaDesignUpdateFocusRequest];
}>();
</script>

<template>
  <tr :data-schema-table="table.name" class="schema-design-table-expanded-row">
    <td class="schema-design-table-expanded-row__cell" colspan="1">
      <div class="schema-design-table-expanded-row__content">
        <SchemaDesignTableDetailCard
          :focus-target="focusTarget"
          :column-layout="columnLayout"
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
      </div>
    </td>
  </tr>
</template>

<style scoped>
@reference '../../style.css';

.schema-design-table-expanded-row {
  @apply align-top;
}

.schema-design-table-expanded-row__cell {
  @apply border-b border-neutral-200 bg-neutral-50 px-2 py-2;
}

.schema-design-table-expanded-row__content {
  @apply flex max-w-5xl flex-col gap-2;
}
</style>
