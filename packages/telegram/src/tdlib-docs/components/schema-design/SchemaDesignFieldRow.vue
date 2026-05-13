<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue';

import { cardsForSlot } from '../../explorerState.js';
import {
  schemaTableTargetMatchesColumn,
  schemaFieldTargetLabel,
  type SchemaDesignSourceFocusTarget,
  type SchemaDesignSourceHoverTarget,
  type SchemaDesignTableColumnDestination,
  type SchemaDesignTableFocusRequest,
  type SchemaDesignTableHoverTarget
} from '../../schemaDesignView.js';
import type { StorageSchemaFieldDesign } from '../../storageReviewTypes.js';
import EntityCard from '../EntityCard.vue';
import TypeRef from '../TypeRef.vue';

const props = defineProps<{
  constructorName: string;
  entryType: string;
  field: StorageSchemaFieldDesign;
  fieldDestinations: SchemaDesignTableColumnDestination[];
  focusTarget: SchemaDesignSourceFocusTarget | null;
  parentInstanceId: string;
  sourceHoverTarget: SchemaDesignSourceHoverTarget | null;
  tableHoverTarget: SchemaDesignTableHoverTarget | null;
}>();

const emit = defineEmits<{
  sourceHover: [target: SchemaDesignSourceHoverTarget | null];
  tableFocus: [target: SchemaDesignTableFocusRequest];
  tableHover: [target: SchemaDesignTableHoverTarget | null];
}>();

const fieldElement = ref<HTMLElement | null>(null);
const inlineCards = computed(() => cardsForSlot(props.parentInstanceId, fieldSlot()));
const hovered = computed(
  () => sourceHoverMatchesField() || props.fieldDestinations.some(destinationHovered)
);
const highlighted = ref(false);
let highlightTimeout: number | null = null;

watch(
  () => props.focusTarget?.id,
  () => {
    if (
      props.focusTarget?.type === props.entryType &&
      props.focusTarget.constructor === props.constructorName &&
      props.focusTarget.field === props.field.name
    ) {
      void focusField();
    }
  },
  { immediate: true }
);

onBeforeUnmount(() => {
  if (highlightTimeout !== null) {
    window.clearTimeout(highlightTimeout);
  }
});

function fieldSlot(): string {
  return `schema-field:${props.field.name}:${props.field.tdlibType}`;
}

function sourceHoverMatchesField(): boolean {
  return (
    props.sourceHoverTarget !== null &&
    props.sourceHoverTarget.type === props.entryType &&
    props.sourceHoverTarget.constructor === props.constructorName &&
    (props.sourceHoverTarget.field === undefined ||
      props.sourceHoverTarget.field === props.field.name)
  );
}

function destinationHovered(destination: SchemaDesignTableColumnDestination): boolean {
  return schemaTableTargetMatchesColumn(
    destination.table,
    destination.column,
    props.tableHoverTarget
  );
}

function fieldHoverTarget(): SchemaDesignSourceHoverTarget {
  return {
    constructor: props.constructorName,
    field: props.field.name,
    type: props.entryType
  };
}

function onFieldMouseEnter(): void {
  emit('sourceHover', fieldHoverTarget());
}

function onFieldMouseLeave(): void {
  emit('sourceHover', null);
}

function onDestinationMouseEnter(destination: SchemaDesignTableColumnDestination): void {
  emit('tableHover', destination);
}

function onDestinationMouseLeave(): void {
  emit('tableHover', null);
}

function onDestinationTableClick(destination: SchemaDesignTableColumnDestination): void {
  emit('tableFocus', { table: destination.table });
}

function onDestinationColumnClick(destination: SchemaDesignTableColumnDestination): void {
  emit('tableFocus', destination);
}

async function focusField(): Promise<void> {
  await nextTick();
  highlighted.value = false;
  await nextTick();
  highlighted.value = true;
  if (highlightTimeout !== null) {
    window.clearTimeout(highlightTimeout);
  }
  highlightTimeout = window.setTimeout(() => {
    highlighted.value = false;
  }, 1600);
}
</script>

<template>
  <div class="schema-design-field-row-shell">
    <div
      ref="fieldElement"
      :data-focused="highlighted ? 'true' : undefined"
      :data-hovered="hovered ? 'true' : undefined"
      :data-schema-field="field.name"
      class="schema-design-field-row"
      @mouseenter="onFieldMouseEnter"
      @mouseleave="onFieldMouseLeave"
    >
      <span class="schema-design-field-row__name">{{ field.name }}</span>
      <span class="schema-design-field-row__type">
        <TypeRef
          :parent-instance-id="parentInstanceId"
          :slot-key="fieldSlot()"
          :type-name="field.tdlibType"
        />
      </span>
      <span class="schema-design-field-row__target">
        <template v-if="fieldDestinations.length > 0">
          <span
            v-for="destination in fieldDestinations"
            :key="`${destination.table}.${destination.column}`"
            class="schema-design-field-row__destination"
          >
            <button
              class="schema-design-field-row__target-link"
              type="button"
              @click="onDestinationTableClick(destination)"
              @mouseenter="onDestinationMouseEnter(destination)"
              @mouseleave="onDestinationMouseLeave"
            >
              {{ destination.table }}
            </button>
            <span class="schema-design-field-row__target-separator">.</span>
            <button
              class="schema-design-field-row__target-link"
              type="button"
              @click="onDestinationColumnClick(destination)"
              @mouseenter="onDestinationMouseEnter(destination)"
              @mouseleave="onDestinationMouseLeave"
            >
              {{ destination.column }}
            </button>
          </span>
        </template>
        <template v-else>{{ schemaFieldTargetLabel(field) }}</template>
      </span>
    </div>
    <div v-if="inlineCards.length > 0" class="schema-design-field-row__inline-cards">
      <EntityCard v-for="card in inlineCards" :key="card.instanceId" :depth="1" :instance="card" />
    </div>
  </div>
</template>

<style scoped>
@reference '../../style.css';

.schema-design-field-row {
  @apply grid grid-cols-[minmax(220px,0.9fr)_minmax(120px,0.65fr)_minmax(280px,1.6fr)] items-start gap-x-3 gap-y-1 border-b border-neutral-200 px-1 py-1.5 last:border-b-0;
}

.schema-design-field-row-shell {
  @apply flex flex-col;
}

.schema-design-field-row[data-focused='true'] {
  @apply bg-emerald-50;
}

.schema-design-field-row[data-hovered='true'] {
  @apply bg-sky-100;
}

.schema-design-field-row__name {
  @apply min-w-0 break-words rounded px-1 font-mono text-sm leading-snug text-neutral-900;
}

.schema-design-field-row__type {
  @apply min-w-0 break-words text-sm leading-snug;
}

.schema-design-field-row__target {
  @apply min-w-0 break-words text-xs leading-snug text-neutral-700;
}

.schema-design-field-row__destination {
  @apply mr-1 inline-flex max-w-full min-w-0 flex-wrap items-baseline;
}

.schema-design-field-row__target-link {
  @apply relative z-10 min-w-0 max-w-full appearance-none break-all rounded border border-transparent bg-transparent px-0.5 py-0 text-left font-mono text-xs leading-snug text-sky-800 outline-none hover:border-sky-200 hover:bg-sky-50 hover:text-sky-950;
}

.schema-design-field-row__target-separator {
  @apply pointer-events-none relative z-0 -mx-0.5 font-mono text-xs leading-snug text-neutral-400;
}

.schema-design-field-row__inline-cards {
  @apply flex flex-col gap-2 py-2;
}

@media (max-width: 900px) {
  .schema-design-field-row {
    @apply grid-cols-1;
  }
}
</style>
