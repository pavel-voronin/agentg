<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue';

import { cardsForSlot, hideHoverPreview, setHoverKey, toggleInline } from '../../explorerState.js';
import { entityById, resolveEntityId } from '../../schemaIndex.js';
import {
  type SchemaDesignKvMapping,
  schemaSourceFieldMatchesTarget,
  schemaSourceReference,
  schemaTableTargetMatchesColumn,
  type SchemaDesignSourceFocusRequest,
  type SchemaDesignSourceHoverTarget,
  type SchemaDesignSourceReference,
  type SchemaDesignTableFocusRequest,
  type SchemaDesignTableFocusTarget,
  type SchemaDesignTableHoverTarget,
  type SchemaDesignUpdateFocusRequest
} from '../../schemaDesignView.js';
import type {
  StorageSchemaForeignKey,
  StorageSchemaTableColumn
} from '../../storageReviewTypes.js';
import EntityCard from '../EntityCard.vue';
import EntityLink from '../EntityLink.vue';
import SchemaDesignForeignKeyTargets from './SchemaDesignForeignKeyTargets.vue';

const props = defineProps<{
  column: StorageSchemaTableColumn;
  focusTarget: SchemaDesignTableFocusTarget | null;
  foreignKeys: StorageSchemaForeignKey[];
  kvMappings: SchemaDesignKvMapping[];
  sourceHoverTarget: SchemaDesignSourceHoverTarget | null;
  tableName: string;
  tableHoverTarget: SchemaDesignTableHoverTarget | null;
}>();

const emit = defineEmits<{
  kvEntriesFocus: [];
  sourceFocus: [target: SchemaDesignSourceFocusRequest];
  sourceHover: [target: SchemaDesignSourceHoverTarget | null];
  tableFocus: [target: SchemaDesignTableFocusRequest];
  tableHover: [target: SchemaDesignTableHoverTarget | null];
  updateFocus: [target: SchemaDesignUpdateFocusRequest];
}>();

const inlineCards = computed(() =>
  cardsForSlot(rowInstanceId(), sourceSlot()).filter(
    (card) => entityById.get(card.entityId)?.kind !== 'update'
  )
);
const sourceReferences = computed(() =>
  props.column.sourceFields.map((sourceField) => ({
    raw: sourceField,
    reference: schemaSourceReference(sourceField)
  }))
);
const keyRuleCases = computed(() => Object.entries(props.column.keyRule?.cases ?? {}));
const nullabilityLabel = computed(() => (props.column.nullable ? 'null' : 'not null'));
const pgTypeLabel = computed(() => compactPgType(props.column.pgType));
const roleLabel = computed(() => compactColumnRole(props.column.role));
const hovered = computed(
  () =>
    schemaTableTargetMatchesColumn(props.tableName, props.column.name, props.tableHoverTarget) ||
    props.column.sourceFields.some((sourceField) =>
      schemaSourceFieldMatchesTarget(sourceField, props.sourceHoverTarget)
    )
);
const highlighted = ref(false);
let highlightTimeout: number | null = null;

watch(
  () => props.focusTarget?.id,
  () => {
    if (
      props.focusTarget?.table === props.tableName &&
      props.focusTarget.column === props.column.name
    ) {
      void focusColumn();
    }
  },
  { immediate: true }
);

onBeforeUnmount(() => {
  if (highlightTimeout !== null) {
    window.clearTimeout(highlightTimeout);
  }
});

function compactPgType(pgType: string): string {
  if (pgType === 'bigint') {
    return 'int8';
  }
  if (pgType === 'boolean') {
    return 'bool';
  }
  if (pgType === 'double precision') {
    return 'float8';
  }
  if (pgType === 'integer') {
    return 'int4';
  }
  if (pgType === 'timestamp with time zone') {
    return 'timestamptz';
  }

  return pgType;
}

function compactColumnRole(role: StorageSchemaTableColumn['role']): string {
  if (role === 'primary-key') {
    return 'PK';
  }
  if (role === 'foreign-key') {
    return 'FK';
  }

  return '';
}

function rowInstanceId(): string {
  return `schema-table-column:${props.tableName}:${props.column.name}`;
}

function sourceSlot(): string {
  return `schema-table-column-source:${props.column.name}`;
}

function constructorSlot(reference: SchemaDesignSourceReference): string {
  return `schema-table-column-source-constructor:${reference.raw}`;
}

function keyRuleSlot(constructorName: string): string {
  return `schema-table-column-key-rule:${props.column.name}:${constructorName}`;
}

function columnHoverTarget(): SchemaDesignTableHoverTarget {
  return {
    column: props.column.name,
    table: props.tableName
  };
}

function onColumnMouseEnter(): void {
  emit('tableHover', columnHoverTarget());
}

function onColumnMouseLeave(): void {
  emit('tableHover', null);
}

function onSourceMouseEnter(reference: SchemaDesignSourceReference): void {
  emit('sourceHover', {
    constructor: reference.constructor,
    ...(reference.field === undefined ? {} : { field: reference.field }),
    type: reference.type
  });
}

function onSourceMouseLeave(): void {
  emit('sourceHover', null);
}

function onConstructorSourceClick(event: MouseEvent, reference: SchemaDesignSourceReference): void {
  event.preventDefault();
  const target = {
    constructor: reference.constructor,
    type: reference.type
  };

  if (reference.type === 'Update') {
    emit('updateFocus', { update: reference.constructor });
    return;
  }

  if (reference.type === 'Function') {
    openSourceInline(reference);
    return;
  }

  emit('sourceFocus', target);
}

function onFieldSourceClick(reference: SchemaDesignSourceReference): void {
  if (reference.field === undefined) {
    return;
  }

  const target = {
    constructor: reference.constructor,
    field: reference.field,
    type: reference.type
  };

  if (reference.type === 'Update') {
    emit('updateFocus', { update: reference.constructor, field: reference.field });
    return;
  }

  if (reference.type === 'Function') {
    openSourceInline(reference, reference.field);
    return;
  }

  emit('sourceFocus', target);
}

function onKeyRuleSourceClick(event: MouseEvent, constructorName: string): void {
  const entityId = resolveEntityId(constructorName);
  const entity = entityId === null ? null : entityById.get(entityId);
  if (entity?.kind !== 'update') {
    return;
  }

  event.preventDefault();
  emit('updateFocus', { update: constructorName });
}

function openSourceInline(reference: SchemaDesignSourceReference, focusField?: string): void {
  const entityId = resolveEntityId(reference.constructor);
  if (entityId === null) {
    return;
  }

  setHoverKey(null);
  hideHoverPreview();
  toggleInline(rowInstanceId(), sourceSlot(), entityId, focusField);
}

async function focusColumn(): Promise<void> {
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
  <tr
    :data-focused="highlighted ? 'true' : undefined"
    :data-hovered="hovered ? 'true' : undefined"
    :data-role="column.role"
    :data-schema-column="column.name"
    class="schema-design-column-row"
    @mouseenter="onColumnMouseEnter"
    @mouseleave="onColumnMouseLeave"
  >
    <td class="schema-design-column-row__name">{{ column.name }}</td>
    <td :title="column.pgType" class="schema-design-column-row__type">{{ pgTypeLabel }}</td>
    <td class="schema-design-column-row__nullability">{{ nullabilityLabel }}</td>
    <td :title="column.role" class="schema-design-column-row__role">
      <span v-if="roleLabel.length > 0" class="schema-design-column-row__role-label">
        {{ roleLabel }}
      </span>
      <SchemaDesignForeignKeyTargets
        :foreign-keys="foreignKeys"
        @table-focus="emit('tableFocus', $event)"
        @table-hover="emit('tableHover', $event)"
      />
    </td>
    <td class="schema-design-column-row__sources">
      <template v-if="column.keyRule !== undefined">
        <span class="schema-design-column-row__key-rule">
          <span class="schema-design-column-row__key-rule-prefix">
            by {{ column.keyRule.type }}
          </span>
          <span
            v-for="[constructorName, template] in keyRuleCases"
            :key="constructorName"
            class="schema-design-column-row__key-rule-case"
          >
            <EntityLink
              :entity-id="resolveEntityId(constructorName)"
              :parent-instance-id="rowInstanceId()"
              :slot-key="keyRuleSlot(constructorName)"
              :text="constructorName"
              @activate="onKeyRuleSourceClick($event, constructorName)"
            />
            <span class="schema-design-column-row__key-rule-value">={{ template }}</span>
          </span>
        </span>
      </template>
      <template v-else-if="kvMappings.length > 0">
        <button
          class="schema-design-column-row__kv-entries-link"
          type="button"
          @click="emit('kvEntriesFocus')"
        >
          look at KV entries
        </button>
      </template>
      <template v-else>
        <template v-for="source in sourceReferences" :key="source.raw">
          <span
            v-if="source.reference !== null"
            class="schema-design-column-row__source"
            @mouseenter="onSourceMouseEnter(source.reference)"
            @mouseleave="onSourceMouseLeave"
          >
            <EntityLink
              :entity-id="resolveEntityId(source.reference.constructor)"
              :parent-instance-id="rowInstanceId()"
              :slot-key="constructorSlot(source.reference)"
              :text="source.reference.constructor"
              @activate="onConstructorSourceClick($event, source.reference)"
            />
            <span
              v-if="source.reference.field !== undefined"
              class="schema-design-column-row__source-separator"
            >
              .
            </span>
            <button
              v-if="source.reference.field !== undefined"
              class="schema-design-column-row__field-link"
              type="button"
              @click="onFieldSourceClick(source.reference)"
            >
              {{ source.reference.field }}
            </button>
          </span>
          <span v-else class="schema-design-column-row__source">{{ source.raw }}</span>
        </template>
      </template>
    </td>
  </tr>
  <tr v-if="inlineCards.length > 0" class="schema-design-column-row__inline-row">
    <td class="schema-design-column-row__inline-cell" colspan="5">
      <div class="schema-design-column-row__inline-cards">
        <EntityCard
          v-for="card in inlineCards"
          :key="card.instanceId"
          :depth="1"
          :instance="card"
        />
      </div>
    </td>
  </tr>
</template>

<style scoped>
@reference '../../style.css';

.schema-design-column-row {
  @apply border-b border-neutral-200 align-top;
}

.schema-design-column-row[data-role='primary-key'] {
  @apply bg-neutral-50;
}

.schema-design-column-row[data-focused='true'] {
  @apply bg-sky-50;
}

.schema-design-column-row[data-hovered='true'] {
  @apply bg-sky-100;
}

.schema-design-column-row__name {
  @apply min-w-0 break-words px-1 py-1.5 font-mono text-sm leading-snug text-neutral-900;
}

.schema-design-column-row__type {
  @apply whitespace-nowrap px-1 py-1.5 font-mono text-sm leading-snug text-neutral-600;
}

.schema-design-column-row__nullability {
  @apply whitespace-nowrap px-1 py-1.5 font-mono text-xs leading-snug text-neutral-500;
}

.schema-design-column-row__role {
  @apply px-1 py-1.5 font-mono text-xs leading-snug text-neutral-700;
}

.schema-design-column-row__role-label {
  @apply mr-1 whitespace-nowrap font-semibold;
}

.schema-design-column-row__sources {
  @apply min-w-0 max-w-full px-1 py-1.5 text-xs leading-snug text-neutral-700;
}

.schema-design-column-row__source {
  @apply mr-1 inline-flex max-w-full min-w-0 flex-wrap items-baseline;
}

.schema-design-column-row__key-rule {
  @apply flex min-w-0 flex-wrap items-baseline gap-x-1 gap-y-0.5;
}

.schema-design-column-row__key-rule-prefix {
  @apply font-mono text-[0.92em] leading-snug text-neutral-500;
}

.schema-design-column-row__key-rule-case {
  @apply inline-flex max-w-full min-w-0 items-baseline;
}

.schema-design-column-row__key-rule-value {
  @apply min-w-0 break-all font-mono text-[0.92em] leading-snug text-neutral-600;
}

.schema-design-column-row__kv-entries-link {
  @apply mr-1 inline-flex max-w-full appearance-none items-center rounded border border-l-2 border-neutral-200 border-l-rose-500 bg-white px-1 py-0 text-left font-mono text-[0.92em] leading-snug text-rose-700 outline-none hover:border-neutral-300 hover:bg-rose-50 hover:text-rose-900;
}

.schema-design-column-row__source-separator {
  @apply pointer-events-none relative z-0 -mx-0.5 font-mono text-xs leading-snug text-neutral-400;
}

.schema-design-column-row__field-link {
  @apply inline-flex max-w-full appearance-none items-center rounded border border-l-2 border-neutral-200 border-l-neutral-400 bg-white px-1 py-0 text-left font-mono text-[0.92em] leading-snug text-sky-700 outline-none hover:border-neutral-300 hover:bg-sky-50 hover:text-sky-900;
}

.schema-design-column-row__inline-row {
  @apply border-b border-neutral-200 align-top;
}

.schema-design-column-row__inline-cell {
  @apply bg-neutral-50 px-1 py-2;
}

.schema-design-column-row__inline-cards {
  @apply flex flex-col gap-2;
}
</style>
