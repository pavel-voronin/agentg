<script setup lang="ts">
import { computed, watch } from 'vue';

import { storageReviewButtonKey, storageReviewButtons } from '../../storageReviewDisplay.js';
import {
  schemaConstructors,
  schemaConstructorSummaryLabel,
  schemaProgressForEntry,
  type SchemaDesignSourceFocusTarget,
  type SchemaDesignSourceHoverTarget,
  type SchemaDesignTableFocusRequest,
  type SchemaDesignTableHoverTarget
} from '../../schemaDesignView.js';
import type { StorageReviewEntry, StorageSchemaTable } from '../../storageReviewTypes.js';
import SchemaDesignProgressMeter from './SchemaDesignProgressMeter.vue';
import SchemaDesignStorageBadge from './SchemaDesignStorageBadge.vue';
import SchemaDesignTypeExpandedRow from './SchemaDesignTypeExpandedRow.vue';
import SchemaDesignTypeTag from './SchemaDesignTypeTag.vue';
import StorageReviewButtons from '../StorageReviewButtons.vue';

const props = defineProps<{
  detailExpanded: boolean;
  entry: StorageReviewEntry;
  expandedReviewKeys: Set<string>;
  focusTarget: SchemaDesignSourceFocusTarget | null;
  maxReviewNoteCount: number;
  sourceHoverTarget: SchemaDesignSourceHoverTarget | null;
  tables: StorageSchemaTable[];
  tableHoverTarget: SchemaDesignTableHoverTarget | null;
}>();

const emit = defineEmits<{
  detailExpandedChange: [expanded: boolean];
  reviewClose: [reviewIndex: number];
  reviewToggle: [reviewIndex: number];
  sourceHover: [target: SchemaDesignSourceHoverTarget | null];
  tableFocus: [target: SchemaDesignTableFocusRequest];
  tableHover: [target: SchemaDesignTableHoverTarget | null];
}>();

const constructors = computed(() => schemaConstructors(props.entry));
const progress = computed(() => schemaProgressForEntry(props.entry));
const constructorSummary = computed(() => schemaConstructorSummaryLabel(constructors.value));
const expandedReviewIndexList = computed(() =>
  storageReviewButtons(props.entry)
    .filter((reviewButton) =>
      props.expandedReviewKeys.has(storageReviewButtonKey(props.entry, reviewButton.index))
    )
    .map((reviewButton) => reviewButton.index)
);

watch(
  () => props.focusTarget?.id,
  () => {
    if (props.focusTarget?.type === props.entry.type) {
      emit('detailExpandedChange', true);
    }
  },
  { immediate: true }
);

function toggleDetail(): void {
  emit('detailExpandedChange', !props.detailExpanded);
}
</script>

<template>
  <tr :data-schema-type-row="entry.type" class="schema-design-type-row">
    <td class="schema-design-type-row__cell">
      <div class="schema-design-type-row__content">
        <div class="schema-design-type-row__primary">
          <SchemaDesignTypeTag
            :constructors="constructors"
            :entry="entry"
            :expanded="detailExpanded"
            :progress="progress"
            @toggle="toggleDetail"
          />
          <span class="schema-design-type-row__summary">{{ constructorSummary }}</span>
        </div>
        <SchemaDesignStorageBadge :entry="entry" />
        <StorageReviewButtons
          :entry="entry"
          :max-note-count="maxReviewNoteCount"
          @toggle="emit('reviewToggle', $event)"
        />
        <SchemaDesignProgressMeter :progress="progress" />
      </div>
    </td>
  </tr>
  <SchemaDesignTypeExpandedRow
    v-if="detailExpanded"
    :constructors="constructors"
    :entry="entry"
    :expanded-review-indexes="expandedReviewIndexList"
    :focus-target="focusTarget"
    :source-hover-target="sourceHoverTarget"
    :tables="tables"
    :table-hover-target="tableHoverTarget"
    @close-review="emit('reviewClose', $event)"
    @source-hover="emit('sourceHover', $event)"
    @table-focus="emit('tableFocus', $event)"
    @table-hover="emit('tableHover', $event)"
  />
</template>

<style scoped>
@reference '../../style.css';

.schema-design-type-row {
  @apply align-top;
}

.schema-design-type-row__cell {
  @apply border-b border-neutral-200 px-2 py-px;
}

.schema-design-type-row__content {
  @apply grid min-w-0 grid-cols-[minmax(0,1fr)_auto_3rem_auto_auto] items-center gap-2 whitespace-nowrap;
}

.schema-design-type-row__primary {
  @apply flex min-w-0 items-center gap-1.5 overflow-hidden;
}

.schema-design-type-row__summary {
  @apply shrink-0 font-mono text-[10px] leading-none text-neutral-400;
}
</style>
