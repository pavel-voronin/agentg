<script setup lang="ts">
import type {
  SchemaDesignFieldLayout,
  SchemaDesignLeftPane as SchemaDesignLeftPaneName,
  SchemaDesignSourceFocusRequest,
  SchemaDesignSourceFocusTarget,
  SchemaDesignSourceHoverTarget,
  SchemaDesignTableFocusRequest,
  SchemaDesignTableHoverTarget,
  SchemaDesignUpdateFocusTarget
} from '../../schemaDesignView.js';
import type {
  StorageReviewEntry,
  StorageSchemaTable,
  StorageSchemaUpdateDesign
} from '../../storageReviewTypes.js';
import type { TdlibCallableEntity } from '../../types.js';
import SchemaDesignTypeTable from './SchemaDesignTypeTable.vue';
import SchemaDesignUpdateTable from './SchemaDesignUpdateTable.vue';

defineProps<{
  activePane: SchemaDesignLeftPaneName;
  allEntries: StorageReviewEntry[];
  allTables: StorageSchemaTable[];
  entries: StorageReviewEntry[];
  expandedReviewKeys: Set<string>;
  expandedTypeNames: Set<string>;
  expandedUpdateNames: Set<string>;
  fieldLayout: SchemaDesignFieldLayout;
  focusTarget: SchemaDesignSourceFocusTarget | null;
  maxReviewNoteCount: number;
  sourceHoverTarget: SchemaDesignSourceHoverTarget | null;
  tables: StorageSchemaTable[];
  tableHoverTarget: SchemaDesignTableHoverTarget | null;
  totalEntryCount: number;
  totalUpdateCount: number;
  typeScrollTop: number;
  updateFocusTarget: SchemaDesignUpdateFocusTarget | null;
  updateDesigns: Record<string, StorageSchemaUpdateDesign>;
  updates: TdlibCallableEntity[];
  updateScrollTop: number;
}>();

const emit = defineEmits<{
  fieldLayoutChange: [fieldLayout: SchemaDesignFieldLayout];
  sourceFocus: [target: SchemaDesignSourceFocusRequest];
  sourceHover: [target: SchemaDesignSourceHoverTarget | null];
  tableFocus: [target: SchemaDesignTableFocusRequest];
  tableHover: [target: SchemaDesignTableHoverTarget | null];
  typeExpandedChange: [typeName: string, expanded: boolean];
  typeReviewClose: [typeName: string, reviewIndex: number];
  typeReviewToggle: [typeName: string, reviewIndex: number];
  typeScrollChange: [scrollTop: number];
  updateExpandedChange: [updateName: string, expanded: boolean];
  updateScrollChange: [scrollTop: number];
}>();
</script>

<template>
  <section class="schema-design-left-pane">
    <SchemaDesignTypeTable
      v-if="activePane === 'types'"
      :entries="entries"
      :expanded-review-keys="expandedReviewKeys"
      :expanded-type-names="expandedTypeNames"
      :focus-target="focusTarget"
      :max-review-note-count="maxReviewNoteCount"
      :scroll-top="typeScrollTop"
      :source-hover-target="sourceHoverTarget"
      :tables="tables"
      :table-hover-target="tableHoverTarget"
      :total-entry-count="totalEntryCount"
      @scroll-change="emit('typeScrollChange', $event)"
      @table-focus="emit('tableFocus', $event)"
      @source-hover="emit('sourceHover', $event)"
      @table-hover="emit('tableHover', $event)"
      @type-expanded-change="(typeName, expanded) => emit('typeExpandedChange', typeName, expanded)"
      @type-review-close="(typeName, reviewIndex) => emit('typeReviewClose', typeName, reviewIndex)"
      @type-review-toggle="
        (typeName, reviewIndex) => emit('typeReviewToggle', typeName, reviewIndex)
      "
    />
    <SchemaDesignUpdateTable
      v-else
      :entries="allEntries"
      :expanded-update-names="expandedUpdateNames"
      :field-layout="fieldLayout"
      :focus-target="updateFocusTarget"
      :scroll-top="updateScrollTop"
      :tables="allTables"
      :total-update-count="totalUpdateCount"
      :update-designs="updateDesigns"
      :updates="updates"
      @source-focus="emit('sourceFocus', $event)"
      @field-layout-change="emit('fieldLayoutChange', $event)"
      @scroll-change="emit('updateScrollChange', $event)"
      @table-focus="emit('tableFocus', $event)"
      @update-expanded-change="
        (updateName, expanded) => emit('updateExpandedChange', updateName, expanded)
      "
    />
  </section>
</template>

<style scoped>
@reference '../../style.css';

.schema-design-left-pane {
  @apply h-full min-h-0 overflow-hidden border-r-2 border-neutral-300 bg-white;
}
</style>
