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
import SchemaDesignTypeDetailCard from './SchemaDesignTypeDetailCard.vue';

defineProps<{
  constructors: StorageSchemaConstructorDesign[];
  entry: StorageReviewEntry;
  expandedReviewIndexes: number[];
  focusTarget: SchemaDesignSourceFocusTarget | null;
  sourceHoverTarget: SchemaDesignSourceHoverTarget | null;
  tables: StorageSchemaTable[];
  tableHoverTarget: SchemaDesignTableHoverTarget | null;
}>();

const emit = defineEmits<{
  closeReview: [reviewIndex: number];
  sourceHover: [target: SchemaDesignSourceHoverTarget | null];
  tableFocus: [target: SchemaDesignTableFocusRequest];
  tableHover: [target: SchemaDesignTableHoverTarget | null];
}>();
</script>

<template>
  <tr :data-schema-type="entry.type" class="schema-design-type-expanded-row">
    <td class="schema-design-type-expanded-row__cell" colspan="1">
      <div class="schema-design-type-expanded-row__content">
        <SchemaDesignTypeDetailCard
          :constructors="constructors"
          :entry="entry"
          :expanded-review-indexes="expandedReviewIndexes"
          :focus-target="focusTarget"
          :source-hover-target="sourceHoverTarget"
          :tables="tables"
          :table-hover-target="tableHoverTarget"
          @close-review="emit('closeReview', $event)"
          @source-hover="emit('sourceHover', $event)"
          @table-focus="emit('tableFocus', $event)"
          @table-hover="emit('tableHover', $event)"
        />
      </div>
    </td>
  </tr>
</template>

<style scoped>
@reference '../../style.css';

.schema-design-type-expanded-row {
  @apply align-top;
}

.schema-design-type-expanded-row__cell {
  @apply border-b border-neutral-200 bg-neutral-50 px-2 py-2;
}

.schema-design-type-expanded-row__content {
  @apply flex max-w-5xl flex-col gap-2;
}
</style>
