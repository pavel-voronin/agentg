<script setup lang="ts">
import {
  schemaColumnDestinationsForSource,
  schemaFieldSourceId,
  type SchemaDesignSourceFocusTarget,
  type SchemaDesignSourceHoverTarget,
  type SchemaDesignTableColumnDestination,
  type SchemaDesignTableFocusRequest,
  type SchemaDesignTableHoverTarget
} from '../../schemaDesignView.js';
import type { StorageSchemaFieldDesign, StorageSchemaTable } from '../../storageReviewTypes.js';
import SchemaDesignFieldRow from './schemaDesignFieldRow.vue';

const props = defineProps<{
  constructorName: string;
  entryType: string;
  fields: StorageSchemaFieldDesign[];
  focusTarget: SchemaDesignSourceFocusTarget | null;
  parentInstanceId: string;
  sourceHoverTarget: SchemaDesignSourceHoverTarget | null;
  tables: StorageSchemaTable[];
  tableHoverTarget: SchemaDesignTableHoverTarget | null;
}>();

const emit = defineEmits<{
  sourceHover: [target: SchemaDesignSourceHoverTarget | null];
  tableFocus: [target: SchemaDesignTableFocusRequest];
  tableHover: [target: SchemaDesignTableHoverTarget | null];
}>();

function fieldDestinations(fieldName: string): SchemaDesignTableColumnDestination[] {
  return schemaColumnDestinationsForSource(
    props.tables,
    schemaFieldSourceId(props.entryType, props.constructorName, fieldName)
  );
}
</script>

<template>
  <section class="schema-design-field-list">
    <h4 v-if="fields.length > 0" class="schema-design-field-list__title">Fields</h4>
    <div v-if="fields.length > 0" class="schema-design-field-list__rows">
      <SchemaDesignFieldRow
        v-for="field in fields"
        :key="field.name"
        :constructor-name="constructorName"
        :entry-type="entryType"
        :field="field"
        :field-destinations="fieldDestinations(field.name)"
        :focus-target="focusTarget"
        :parent-instance-id="parentInstanceId"
        :source-hover-target="sourceHoverTarget"
        :table-hover-target="tableHoverTarget"
        @source-hover="emit('sourceHover', $event)"
        @table-focus="emit('tableFocus', $event)"
        @table-hover="emit('tableHover', $event)"
      />
    </div>
    <p v-else class="schema-design-field-list__empty">&lt;no fields&gt;</p>
  </section>
</template>

<style scoped>
@reference '../../style.css';

.schema-design-field-list {
  @apply mt-3;
}

.schema-design-field-list__title {
  @apply mb-1 text-[11px] font-semibold uppercase leading-none text-neutral-500;
}

.schema-design-field-list__rows {
  @apply flex flex-col;
}

.schema-design-field-list__empty {
  @apply m-0 py-1 text-center font-mono text-xs text-neutral-400;
}
</style>
