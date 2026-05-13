<script setup lang="ts">
import type {
  SchemaDesignSourceFocusTarget,
  SchemaDesignSourceHoverTarget,
  SchemaDesignTableFocusRequest,
  SchemaDesignTableHoverTarget
} from '../../schemaDesignView.js';
import type {
  StorageReviewEntry,
  StorageSchemaConstructorDesign,
  StorageSchemaTable
} from '../../storageReviewTypes.js';
import SchemaDesignConstructorCard from './SchemaDesignConstructorCard.vue';

defineProps<{
  constructors: StorageSchemaConstructorDesign[];
  entry: StorageReviewEntry;
  focusTarget: SchemaDesignSourceFocusTarget | null;
  sourceHoverTarget: SchemaDesignSourceHoverTarget | null;
  tables: StorageSchemaTable[];
  tableHoverTarget: SchemaDesignTableHoverTarget | null;
}>();

const emit = defineEmits<{
  sourceHover: [target: SchemaDesignSourceHoverTarget | null];
  tableFocus: [target: SchemaDesignTableFocusRequest];
  tableHover: [target: SchemaDesignTableHoverTarget | null];
}>();
</script>

<template>
  <section class="schema-design-constructor-list">
    <SchemaDesignConstructorCard
      v-for="constructor in constructors"
      :key="constructor.name"
      :constructor="constructor"
      :entry="entry"
      :focus-target="focusTarget"
      :source-hover-target="sourceHoverTarget"
      :tables="tables"
      :table-hover-target="tableHoverTarget"
      @source-hover="emit('sourceHover', $event)"
      @table-focus="emit('tableFocus', $event)"
      @table-hover="emit('tableHover', $event)"
    />
    <p v-if="constructors.length === 0" class="schema-design-constructor-list__empty">
      No visible constructors
    </p>
  </section>
</template>

<style scoped>
@reference '../../style.css';

.schema-design-constructor-list {
  @apply flex flex-col;
}

.schema-design-constructor-list__empty {
  @apply m-0 py-1 text-xs text-neutral-500;
}
</style>
