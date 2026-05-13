<script setup lang="ts">
import type {
  SchemaDesignFieldLayout,
  SchemaDesignLeftPane as SchemaDesignLeftPaneName,
  SchemaDesignSourceFocusRequest,
  SchemaDesignSourceFocusTarget,
  SchemaDesignSourceHoverTarget,
  SchemaDesignTableFocusRequest,
  SchemaDesignTableFocusTarget,
  SchemaDesignTableHoverTarget,
  SchemaDesignUpdateFocusRequest,
  SchemaDesignUpdateFocusTarget
} from '../../schemaDesignView.js';
import type {
  StorageReviewEntry,
  StorageSchemaColumnLayout,
  StorageSchemaTable,
  StorageSchemaUpdateDesign
} from '../../storageReviewTypes.js';
import type { TdlibCallableEntity } from '../../types.js';
import SchemaDesignLeftPane from './SchemaDesignLeftPane.vue';
import SchemaDesignTableTable from './SchemaDesignTableTable.vue';

defineProps<{
  activeLeftPane: SchemaDesignLeftPaneName;
  allEntries: StorageReviewEntry[];
  allTables: StorageSchemaTable[];
  entries: StorageReviewEntry[];
  expandedReviewKeys: Set<string>;
  expandedTableNames: Set<string>;
  expandedTypeNames: Set<string>;
  expandedUpdateNames: Set<string>;
  fieldLayout: SchemaDesignFieldLayout;
  focusTarget: SchemaDesignSourceFocusTarget | null;
  maxReviewNoteCount: number;
  sourceHoverTarget: SchemaDesignSourceHoverTarget | null;
  tables: StorageSchemaTable[];
  tableFocusTarget: SchemaDesignTableFocusTarget | null;
  tableHoverTarget: SchemaDesignTableHoverTarget | null;
  tableScrollTop: number;
  totalEntryCount: number;
  totalTableCount: number;
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
  tableExpandedChange: [tableName: string, expanded: boolean];
  tableColumnLayoutChange: [tableName: string, columnLayout: StorageSchemaColumnLayout];
  tableScrollChange: [scrollTop: number];
  typeExpandedChange: [typeName: string, expanded: boolean];
  typeReviewClose: [typeName: string, reviewIndex: number];
  typeReviewToggle: [typeName: string, reviewIndex: number];
  typeScrollChange: [scrollTop: number];
  updateExpandedChange: [updateName: string, expanded: boolean];
  updateFocus: [target: SchemaDesignUpdateFocusRequest];
  updateScrollChange: [scrollTop: number];
}>();
</script>

<template>
  <div class="schema-design-split-view">
    <SchemaDesignLeftPane
      :active-pane="activeLeftPane"
      :all-entries="allEntries"
      :all-tables="allTables"
      :entries="entries"
      :expanded-review-keys="expandedReviewKeys"
      :expanded-type-names="expandedTypeNames"
      :expanded-update-names="expandedUpdateNames"
      :field-layout="fieldLayout"
      :focus-target="focusTarget"
      :max-review-note-count="maxReviewNoteCount"
      :source-hover-target="sourceHoverTarget"
      :tables="tables"
      :table-hover-target="tableHoverTarget"
      :total-entry-count="totalEntryCount"
      :total-update-count="totalUpdateCount"
      :type-scroll-top="typeScrollTop"
      :update-focus-target="updateFocusTarget"
      :update-designs="updateDesigns"
      :updates="updates"
      :update-scroll-top="updateScrollTop"
      @source-focus="emit('sourceFocus', $event)"
      @field-layout-change="emit('fieldLayoutChange', $event)"
      @table-focus="emit('tableFocus', $event)"
      @source-hover="emit('sourceHover', $event)"
      @table-hover="emit('tableHover', $event)"
      @type-expanded-change="(typeName, expanded) => emit('typeExpandedChange', typeName, expanded)"
      @type-review-close="(typeName, reviewIndex) => emit('typeReviewClose', typeName, reviewIndex)"
      @type-review-toggle="
        (typeName, reviewIndex) => emit('typeReviewToggle', typeName, reviewIndex)
      "
      @type-scroll-change="emit('typeScrollChange', $event)"
      @update-expanded-change="
        (updateName, expanded) => emit('updateExpandedChange', updateName, expanded)
      "
      @update-scroll-change="emit('updateScrollChange', $event)"
    />
    <SchemaDesignTableTable
      :entries="allEntries"
      :expanded-table-names="expandedTableNames"
      :focus-target="tableFocusTarget"
      :scroll-top="tableScrollTop"
      :source-hover-target="sourceHoverTarget"
      :tables="tables"
      :table-hover-target="tableHoverTarget"
      :total-table-count="totalTableCount"
      @scroll-change="emit('tableScrollChange', $event)"
      @table-expanded-change="
        (tableName, expanded) => emit('tableExpandedChange', tableName, expanded)
      "
      @table-column-layout-change="
        (tableName, columnLayout) => emit('tableColumnLayoutChange', tableName, columnLayout)
      "
      @source-focus="emit('sourceFocus', $event)"
      @source-hover="emit('sourceHover', $event)"
      @table-focus="emit('tableFocus', $event)"
      @table-hover="emit('tableHover', $event)"
      @update-focus="emit('updateFocus', $event)"
    />
  </div>
</template>

<style scoped>
@reference '../../style.css';

.schema-design-split-view {
  @apply grid h-full min-h-0 flex-1 grid-cols-2 overflow-hidden;
}

@media (max-width: 1100px) {
  .schema-design-split-view {
    @apply grid-cols-1 overflow-auto;
  }
}
</style>
