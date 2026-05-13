<script setup lang="ts">
import { ref } from 'vue';

import { resolveEntityId } from '../../schemaIndex.js';
import {
  type SchemaDesignKvMapping,
  type SchemaDesignSourceFocusRequest,
  type SchemaDesignSourceHoverTarget,
  type SchemaDesignTableFocusRequest,
  type SchemaDesignTableFocusTarget,
  type SchemaDesignTableHoverTarget,
  type SchemaDesignUpdateFocusRequest
} from '../../schemaDesignView.js';
import type { StorageSchemaColumnLayout, StorageSchemaTable } from '../../storageReviewTypes.js';
import EntityLink from '../EntityLink.vue';
import SchemaDesignColumnList from './SchemaDesignColumnList.vue';
import SchemaDesignKvEntryList from './SchemaDesignKvEntryList.vue';

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
  sourceFocus: [target: SchemaDesignSourceFocusRequest];
  sourceHover: [target: SchemaDesignSourceHoverTarget | null];
  tableFocus: [target: SchemaDesignTableFocusRequest];
  tableHover: [target: SchemaDesignTableHoverTarget | null];
  updateFocus: [target: SchemaDesignUpdateFocusRequest];
}>();

const kvEntryList = ref<InstanceType<typeof SchemaDesignKvEntryList> | null>(null);

function tableInstanceId(): string {
  return `schema-table-detail:${props.table.name}`;
}

function sourceTypeSlot(sourceType: string): string {
  return `schema-table-source-type:${sourceType}`;
}

function onSourceTypeActivate(event: MouseEvent, sourceType: string): void {
  event.preventDefault();
  emit('sourceFocus', { type: sourceType });
}

function focusKvEntries(): void {
  void kvEntryList.value?.focusList();
}
</script>

<template>
  <article class="schema-design-table-detail-card">
    <header class="schema-design-table-detail-card__header">
      <div class="schema-design-table-detail-card__heading">
        <span class="schema-design-table-detail-card__kind">table</span>
        <h3 class="schema-design-table-detail-card__title">{{ table.name }}</h3>
      </div>
    </header>
    <section class="schema-design-table-detail-card__section">
      <h4 class="schema-design-table-detail-card__section-title">Source types</h4>
      <div class="schema-design-table-detail-card__source-groups">
        <div class="schema-design-table-detail-card__source-group">
          <span class="schema-design-table-detail-card__source-label">direct</span>
          <div class="schema-design-table-detail-card__source-types">
            <EntityLink
              v-for="sourceType in table.sourceTypes"
              :key="sourceType"
              :entity-id="resolveEntityId(sourceType)"
              :parent-instance-id="tableInstanceId()"
              :slot-key="sourceTypeSlot(sourceType)"
              :text="sourceType"
              @activate="onSourceTypeActivate($event, sourceType)"
            />
            <span
              v-if="table.sourceTypes.length === 0"
              class="schema-design-table-detail-card__empty"
            >
              none
            </span>
          </div>
        </div>
        <div class="schema-design-table-detail-card__source-group">
          <span class="schema-design-table-detail-card__source-label">indirect</span>
          <div class="schema-design-table-detail-card__source-types">
            <EntityLink
              v-for="sourceType in table.indirectSourceTypes"
              :key="sourceType"
              :entity-id="resolveEntityId(sourceType)"
              :parent-instance-id="tableInstanceId()"
              :slot-key="sourceTypeSlot(sourceType)"
              :text="sourceType"
              @activate="onSourceTypeActivate($event, sourceType)"
            />
            <span
              v-if="table.indirectSourceTypes.length === 0"
              class="schema-design-table-detail-card__empty"
            >
              none
            </span>
          </div>
        </div>
      </div>
    </section>
    <SchemaDesignKvEntryList
      v-if="kvMappings.length > 0"
      ref="kvEntryList"
      :mappings="kvMappings"
      :parent-instance-id="tableInstanceId()"
      :source-hover-target="sourceHoverTarget"
      @source-focus="emit('sourceFocus', $event)"
      @source-hover="emit('sourceHover', $event)"
      @update-focus="emit('updateFocus', $event)"
    />
    <SchemaDesignColumnList
      :column-layout="columnLayout"
      :focus-target="focusTarget"
      :kv-mappings="kvMappings"
      :source-hover-target="sourceHoverTarget"
      :table="table"
      :table-hover-target="tableHoverTarget"
      @column-layout-change="emit('columnLayoutChange', $event)"
      @kv-entries-focus="focusKvEntries"
      @source-focus="emit('sourceFocus', $event)"
      @source-hover="emit('sourceHover', $event)"
      @table-focus="emit('tableFocus', $event)"
      @table-hover="emit('tableHover', $event)"
      @update-focus="emit('updateFocus', $event)"
    />
  </article>
</template>

<style scoped>
@reference '../../style.css';

.schema-design-table-detail-card {
  @apply rounded border border-l-4 border-neutral-200 border-l-rose-500 bg-white p-3;
}

.schema-design-table-detail-card__header {
  @apply flex items-start justify-between gap-2;
}

.schema-design-table-detail-card__heading {
  @apply min-w-0;
}

.schema-design-table-detail-card__kind {
  @apply text-[11px] font-semibold uppercase leading-none text-neutral-500;
}

.schema-design-table-detail-card__title {
  @apply m-0 mt-1 break-words font-mono text-lg font-semibold leading-tight text-neutral-950;
}

.schema-design-table-detail-card__section {
  @apply mt-3;
}

.schema-design-table-detail-card__section-title {
  @apply mb-1 text-[11px] font-semibold uppercase leading-none text-neutral-500;
}

.schema-design-table-detail-card__section-value {
  @apply m-0 rounded border border-neutral-200 bg-neutral-50 px-2 py-1 font-mono text-xs text-neutral-800;
}

.schema-design-table-detail-card__source-groups {
  @apply grid grid-cols-[max-content_minmax(0,1fr)] items-start gap-x-2 gap-y-1;
}

.schema-design-table-detail-card__source-group {
  @apply contents;
}

.schema-design-table-detail-card__source-label {
  @apply pt-0.5 text-[10px] font-semibold uppercase leading-none text-neutral-500;
}

.schema-design-table-detail-card__source-types {
  @apply flex min-w-0 flex-wrap gap-1;
}

.schema-design-table-detail-card__empty {
  @apply font-mono text-xs text-neutral-500;
}
</style>
