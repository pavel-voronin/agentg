<script setup lang="ts">
import { computed } from 'vue';

import {
  type SchemaDesignFieldLayout,
  type SchemaDesignProgress,
  schemaUpdateInstanceId,
  schemaUpdateProcessForUpdate,
  schemaUpdateSlot,
  type SchemaDesignSourceFocusRequest,
  type SchemaDesignTableFocusRequest,
  type SchemaDesignUpdateFocusTarget
} from '../../schemaDesignView.js';
import type {
  StorageReviewEntry,
  StorageSchemaTable,
  StorageSchemaUpdateDesign
} from '../../storageReviewTypes.js';
import type { TdlibCallableEntity } from '../../types.js';
import SchemaDesignUpdateExpandedRow from './schemaDesignUpdateExpandedRow.vue';
import SchemaDesignProgressMeter from './schemaDesignProgressMeter.vue';
import SchemaDesignUpdateTag from './schemaDesignUpdateTag.vue';

const props = defineProps<{
  detailExpanded: boolean;
  entries: StorageReviewEntry[];
  fieldLayout: SchemaDesignFieldLayout;
  focusTarget: SchemaDesignUpdateFocusTarget | null;
  tables: StorageSchemaTable[];
  update: TdlibCallableEntity;
  updateDesign: StorageSchemaUpdateDesign | undefined;
}>();

const emit = defineEmits<{
  detailExpandedChange: [expanded: boolean];
  fieldLayoutChange: [fieldLayout: SchemaDesignFieldLayout];
  sourceFocus: [target: SchemaDesignSourceFocusRequest];
  tableFocus: [target: SchemaDesignTableFocusRequest];
}>();

const parentInstanceId = computed(() => schemaUpdateInstanceId(props.update.name));
const slotKey = computed(() => schemaUpdateSlot(props.update.name));
const process = computed(() =>
  schemaUpdateProcessForUpdate(props.update, props.entries, props.tables, props.updateDesign)
);
const handlerPlan = computed(() => props.updateDesign?.handlerPlan);
const progress = computed<SchemaDesignProgress>(() => ({
  covered: process.value.routedFieldCount,
  kind: 'fields',
  ready: process.value.gapCount === 0,
  title: `update fields ${String(process.value.routedFieldCount)} / ${String(
    process.value.totalFieldCount
  )}`,
  total: process.value.totalFieldCount
}));

function toggleDetail(): void {
  emit('detailExpandedChange', !props.detailExpanded);
}
</script>

<template>
  <tr :data-schema-update-row="update.name" class="schema-design-update-row">
    <td class="schema-design-update-row__cell">
      <div class="schema-design-update-row__content">
        <div class="schema-design-update-row__primary">
          <SchemaDesignUpdateTag
            :expanded="detailExpanded"
            :parent-instance-id="parentInstanceId"
            :slot-key="slotKey"
            :update="update"
            @toggle="toggleDetail"
          />
        </div>
        <div class="schema-design-update-row__progress">
          <span
            v-if="handlerPlan !== undefined"
            class="schema-design-update-row__plan"
            :title="`handler plan maturity ${String(handlerPlan.maturity)} ${handlerPlan.status}`"
          >
            plan
          </span>
          <SchemaDesignProgressMeter :progress="progress" />
        </div>
      </div>
    </td>
  </tr>
  <SchemaDesignUpdateExpandedRow
    v-if="detailExpanded"
    :entries="entries"
    :field-layout="fieldLayout"
    :focus-target="focusTarget"
    :tables="tables"
    :update="update"
    :update-design="updateDesign"
    :update-name="update.name"
    @field-layout-change="emit('fieldLayoutChange', $event)"
    @source-focus="emit('sourceFocus', $event)"
    @table-focus="emit('tableFocus', $event)"
  />
</template>

<style scoped>
@reference '../../style.css';

.schema-design-update-row {
  @apply align-top;
}

.schema-design-update-row__cell {
  @apply border-b border-neutral-200 px-2 py-px;
}

.schema-design-update-row__content {
  @apply grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-2 whitespace-nowrap;
}

.schema-design-update-row__primary {
  @apply flex min-w-0 items-center gap-1.5 overflow-hidden;
}

.schema-design-update-row__progress {
  @apply flex shrink-0 items-center justify-end gap-1.5;
}

.schema-design-update-row__plan {
  @apply rounded border border-emerald-200 bg-emerald-50 px-1 py-0 font-mono text-[10px] font-semibold leading-snug text-emerald-700;
}

@media (max-width: 900px) {
  .schema-design-update-row__content {
    @apply grid-cols-[minmax(0,1fr)];
  }

  .schema-design-update-row__progress {
    @apply justify-start;
  }
}
</style>
