<script setup lang="ts">
import { computed } from 'vue';

import { cardsForSlot, hideHoverPreview, setHoverKey } from '../../explorerState.js';
import type {
  SchemaDesignSourceFocusTarget,
  SchemaDesignSourceHoverTarget,
  SchemaDesignTableFocusRequest,
  SchemaDesignTableHoverTarget
} from '../../schemaDesignView.js';
import { schemaConstructorTargetLabel } from '../../schemaDesignView.js';
import { resolveEntityId } from '../../schemaIndex.js';
import type {
  StorageReviewEntry,
  StorageSchemaConstructorDesign,
  StorageSchemaTable
} from '../../storageReviewTypes.js';
import EntityCard from '../entityCard.vue';
import EntityLink from '../entityLink.vue';
import SchemaDesignFieldList from './schemaDesignFieldList.vue';

const props = defineProps<{
  constructor: StorageSchemaConstructorDesign;
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

const constructorCards = computed(() => cardsForSlot(constructorInstanceId(), constructorSlot()));
const targetLabel = computed(() => schemaConstructorTargetLabel(props.constructor));

function constructorEntityId(): string | null {
  return resolveEntityId(props.constructor.name);
}

function constructorInstanceId(): string {
  return `schema-constructor:${props.entry.type}:${props.constructor.name}`;
}

function constructorSlot(): string {
  return `schema-constructor-card:${props.constructor.name}`;
}

function onConstructorActivate(): void {
  setHoverKey(null);
  hideHoverPreview();
}
</script>

<template>
  <article :data-schema-constructor="constructor.name" class="schema-design-constructor-card">
    <header class="schema-design-constructor-card__header">
      <div class="schema-design-constructor-card__heading">
        <span class="schema-design-constructor-card__kind">constructor</span>
        <h3 class="schema-design-constructor-card__title">
          <EntityLink
            :entity-id="constructorEntityId()"
            :parent-instance-id="constructorInstanceId()"
            :slot-key="constructorSlot()"
            :text="constructor.name"
            @activate="onConstructorActivate"
          />
        </h3>
      </div>
    </header>
    <div v-if="constructorCards.length > 0" class="schema-design-constructor-card__inline-cards">
      <EntityCard
        v-for="card in constructorCards"
        :key="card.instanceId"
        :depth="1"
        :instance="card"
      />
    </div>
    <div v-if="targetLabel !== null" class="schema-design-constructor-card__target">
      <span class="schema-design-constructor-card__target-label">target</span>
      <span class="schema-design-constructor-card__target-value">{{ targetLabel }}</span>
    </div>
    <SchemaDesignFieldList
      :fields="constructor.fields"
      :constructor-name="constructor.name"
      :entry-type="entry.type"
      :focus-target="focusTarget"
      :parent-instance-id="constructorInstanceId()"
      :source-hover-target="sourceHoverTarget"
      :tables="tables"
      :table-hover-target="tableHoverTarget"
      @source-hover="emit('sourceHover', $event)"
      @table-focus="emit('tableFocus', $event)"
      @table-hover="emit('tableHover', $event)"
    />
  </article>
</template>

<style scoped>
@reference '../../style.css';

.schema-design-constructor-card {
  @apply border-t border-neutral-200 py-2 first:border-t-0 first:pt-0 last:pb-0;
}

.schema-design-constructor-card__header {
  @apply flex items-start justify-between gap-2;
}

.schema-design-constructor-card__heading {
  @apply flex min-w-0 items-baseline gap-2;
}

.schema-design-constructor-card__kind {
  @apply shrink-0 text-[10px] font-semibold uppercase leading-none text-emerald-600;
}

.schema-design-constructor-card__title {
  @apply m-0 flex min-w-0 items-center font-mono text-sm font-semibold leading-tight text-neutral-950;
}

.schema-design-constructor-card__target {
  @apply mt-1 grid grid-cols-[max-content_minmax(0,1fr)] gap-2 text-xs leading-snug;
}

.schema-design-constructor-card__target-label {
  @apply text-[10px] font-semibold uppercase text-neutral-500;
}

.schema-design-constructor-card__target-value {
  @apply min-w-0 break-words font-mono text-neutral-700;
}

.schema-design-constructor-card__inline-cards {
  @apply mt-2 flex flex-col gap-2;
}
</style>
