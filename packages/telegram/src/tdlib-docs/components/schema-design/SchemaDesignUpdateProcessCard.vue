<script setup lang="ts">
import { computed, nextTick, ref } from 'vue';

import { cardsForSlot } from '../../explorerState.js';
import {
  type SchemaDesignFieldLayout,
  schemaUpdateProcessForUpdate,
  type SchemaDesignSourceFocusRequest,
  type SchemaDesignTableFocusRequest,
  type SchemaDesignUpdateDbWrite,
  type SchemaDesignUpdateFieldUse,
  type SchemaDesignUpdateFieldRoute,
  type SchemaDesignUpdateFocusTarget,
  type SchemaDesignUpdateTableWrite
} from '../../schemaDesignView.js';
import type {
  StorageReviewEntry,
  StorageSchemaTable,
  StorageSchemaUpdateDesign
} from '../../storageReviewTypes.js';
import type { CardInstance, TdlibCallableEntity } from '../../types.js';
import EntityCard from '../EntityCard.vue';
import TypeRef from '../TypeRef.vue';
import SchemaDesignFieldLayoutControl from './SchemaDesignFieldLayoutControl.vue';

const props = defineProps<{
  entries: StorageReviewEntry[];
  fieldLayout: SchemaDesignFieldLayout;
  focusTarget: SchemaDesignUpdateFocusTarget | null;
  tables: StorageSchemaTable[];
  update: TdlibCallableEntity;
  updateDesign: StorageSchemaUpdateDesign | undefined;
}>();

const emit = defineEmits<{
  fieldLayoutChange: [fieldLayout: SchemaDesignFieldLayout];
  sourceFocus: [target: SchemaDesignSourceFocusRequest];
  tableFocus: [target: SchemaDesignTableFocusRequest];
}>();

const process = computed(() =>
  schemaUpdateProcessForUpdate(props.update, props.entries, props.tables, props.updateDesign)
);
const dbWrites = computed(() => process.value.fieldRoutes.flatMap((route) => route.dbWrites));
const handlerPlan = computed(() => props.updateDesign?.handlerPlan);
const cardElement = ref<HTMLElement | null>(null);
const focusedPlanStepId = ref<string | null>(null);

function cardInstanceId(): string {
  return `schema-update-process:${props.update.name}`;
}

function typeSlot(route: SchemaDesignUpdateFieldRoute): string {
  return `schema-update-process-field-type:${route.field.name}`;
}

function delegateStepSlot(
  route: SchemaDesignUpdateFieldRoute,
  step: SchemaDesignUpdateFieldUse
): string {
  return `schema-update-process-field-delegate:${route.field.name}:${step.id}`;
}

function delegatedStorageSteps(route: SchemaDesignUpdateFieldRoute): SchemaDesignUpdateFieldUse[] {
  return route.handlerPlanSteps.filter(
    (step) => step.op === 'delegateType' && step.type !== undefined
  );
}

function inlineCardsForRoute(route: SchemaDesignUpdateFieldRoute): CardInstance[] {
  return [
    ...cardsForSlot(cardInstanceId(), typeSlot(route)),
    ...delegatedStorageSteps(route).flatMap((step) =>
      cardsForSlot(cardInstanceId(), delegateStepSlot(route, step))
    )
  ];
}

function routeHasDbTarget(route: SchemaDesignUpdateFieldRoute): boolean {
  return (
    route.dbWrites.length > 0 ||
    route.tableWrites.length > 0 ||
    delegatedStorageSteps(route).length > 0
  );
}

function routeIsNotStored(route: SchemaDesignUpdateFieldRoute): boolean {
  return route.status !== 'gap' && !routeHasDbTarget(route);
}

function routeIsFocused(route: SchemaDesignUpdateFieldRoute): boolean {
  return (
    props.focusTarget?.update === props.update.name && props.focusTarget.field === route.field.name
  );
}

function onDbWriteClick(write: SchemaDesignUpdateDbWrite): void {
  emit('tableFocus', {
    column: write.column,
    sourceField: write.sourceField,
    table: write.table
  });
}

function onTableWriteClick(write: SchemaDesignUpdateTableWrite): void {
  emit('tableFocus', {
    table: write.table
  });
}

function stepMeta(step: NonNullable<typeof handlerPlan.value>['steps'][number]): string {
  const parts = [
    step.table,
    step.type,
    step.event,
    step.effect,
    step.condition === undefined ? undefined : `if ${step.condition}`
  ].filter((part): part is string => part !== undefined && part.length > 0);

  return parts.join(' · ');
}

async function onPlanStepUseClick(stepId: string): Promise<void> {
  focusedPlanStepId.value = stepId;
  await nextTick();

  const stepElement = [
    ...(cardElement.value?.querySelectorAll<HTMLElement>('[data-handler-plan-step]') ?? [])
  ].find((element) => element.dataset.handlerPlanStep === stepId);
  stepElement?.focus({ preventScroll: true });
  stepElement?.scrollIntoView({ block: 'center', inline: 'nearest' });
}
</script>

<template>
  <article ref="cardElement" class="schema-design-update-process-card">
    <header class="schema-design-update-process-card__header">
      <div class="schema-design-update-process-card__heading">
        <span class="schema-design-update-process-card__kind">update process</span>
        <h3 class="schema-design-update-process-card__title">{{ update.name }}</h3>
        <p class="schema-design-update-process-card__description">{{ update.description }}</p>
      </div>
      <div class="schema-design-update-process-card__metrics">
        <span class="schema-design-update-process-card__metric">
          {{ process.routedFieldCount }} / {{ process.totalFieldCount }} routed
        </span>
        <span class="schema-design-update-process-card__metric">
          {{ process.dbWriteCount }} db
        </span>
        <span class="schema-design-update-process-card__metric">
          {{ process.eventCount }} events
        </span>
        <span class="schema-design-update-process-card__metric">
          {{ process.effectCount }} effects
        </span>
      </div>
    </header>

    <section v-if="handlerPlan !== undefined" class="schema-design-update-process-card__section">
      <div class="schema-design-update-process-card__section-header">
        <h4 class="schema-design-update-process-card__section-title">Handler plan</h4>
        <span class="schema-design-update-process-card__plan-state">
          m{{ handlerPlan.maturity }} {{ handlerPlan.status }}
        </span>
      </div>
      <p class="schema-design-update-process-card__plan-summary">{{ handlerPlan.summary }}</p>
      <ol class="schema-design-update-process-card__plan-steps">
        <li
          v-for="step in handlerPlan.steps"
          :key="step.id"
          :data-focused="focusedPlanStepId === step.id ? 'true' : undefined"
          :data-handler-plan-step="step.id"
          tabindex="-1"
          class="schema-design-update-process-card__plan-step"
        >
          <span class="schema-design-update-process-card__plan-op">{{ step.op }}</span>
          <span class="schema-design-update-process-card__plan-description">
            {{ step.description }}
          </span>
          <span
            v-if="stepMeta(step).length > 0"
            class="schema-design-update-process-card__plan-meta"
          >
            {{ stepMeta(step) }}
          </span>
          <span class="schema-design-update-process-card__plan-sources">
            {{ step.sourceFields.join(', ') }}
          </span>
        </li>
      </ol>
    </section>

    <section class="schema-design-update-process-card__section">
      <div class="schema-design-update-process-card__section-header">
        <h4 class="schema-design-update-process-card__section-title">Fields</h4>
        <SchemaDesignFieldLayoutControl
          :field-layout="fieldLayout"
          @change="emit('fieldLayoutChange', $event)"
        />
      </div>

      <div v-if="fieldLayout === 'grid'" class="schema-design-update-process-card__field-grid">
        <div class="schema-design-update-process-card__field-grid-heading">Field</div>
        <div class="schema-design-update-process-card__field-grid-heading">Type</div>
        <div class="schema-design-update-process-card__field-grid-heading">Use</div>
        <div class="schema-design-update-process-card__field-grid-heading">DB</div>
        <div
          v-for="route in process.fieldRoutes"
          :key="route.field.name"
          :data-focused="routeIsFocused(route) ? 'true' : undefined"
          :data-status="route.status"
          :data-schema-update-field="route.field.name"
          class="schema-design-update-process-card__field-grid-row"
        >
          <div class="schema-design-update-process-card__field-name">{{ route.field.name }}</div>
          <div class="schema-design-update-process-card__field-type">
            <TypeRef
              :parent-instance-id="cardInstanceId()"
              :slot-key="typeSlot(route)"
              :type-name="route.field.type"
            />
          </div>
          <div class="schema-design-update-process-card__field-use">
            <button
              v-for="step in route.handlerPlanSteps"
              :key="step.id"
              class="schema-design-update-process-card__plan-use"
              :title="`${step.op}: ${step.description}`"
              type="button"
              @click="onPlanStepUseClick(step.id)"
            >
              #{{ String(step.stepNumber) }}
            </button>
            <span
              v-if="route.status === 'gap'"
              class="schema-design-update-process-card__route-gap"
            >
              gap
            </span>
          </div>
          <div class="schema-design-update-process-card__field-db">
            <button
              v-for="write in route.tableWrites"
              :key="write.id"
              class="schema-design-update-process-card__db-table"
              :title="`${write.op}: ${write.description}`"
              type="button"
              @click="onTableWriteClick(write)"
            >
              {{ write.table }}
            </button>
            <span
              v-for="step in delegatedStorageSteps(route)"
              :key="step.id"
              class="schema-design-update-process-card__db-delegate"
              :title="`${step.op}: ${step.description}`"
            >
              via
              <TypeRef
                :parent-instance-id="cardInstanceId()"
                :slot-key="delegateStepSlot(route, step)"
                :type-name="step.type ?? ''"
              />
            </span>
            <span v-if="routeIsNotStored(route)" class="schema-design-update-process-card__db-none">
              not stored
            </span>
            <button
              v-for="write in route.dbWrites"
              :key="`${write.columnId}:${write.sourceField}`"
              class="schema-design-update-process-card__db-write"
              type="button"
              @click="onDbWriteClick(write)"
            >
              {{ write.table }}.{{ write.column }}
            </button>
          </div>
          <div
            v-if="inlineCardsForRoute(route).length > 0"
            class="schema-design-update-process-card__inline-cards"
          >
            <EntityCard
              v-for="card in inlineCardsForRoute(route)"
              :key="card.instanceId"
              :depth="1"
              :instance="card"
            />
          </div>
        </div>
      </div>

      <div v-else class="schema-design-update-process-card__field-stack">
        <div
          v-for="route in process.fieldRoutes"
          :key="route.field.name"
          :data-focused="routeIsFocused(route) ? 'true' : undefined"
          :data-status="route.status"
          :data-schema-update-field="route.field.name"
          class="schema-design-update-process-card__field-stack-row"
        >
          <div class="schema-design-update-process-card__field-stack-label">field</div>
          <div class="schema-design-update-process-card__field-name">{{ route.field.name }}</div>
          <div class="schema-design-update-process-card__field-stack-label">type</div>
          <div class="schema-design-update-process-card__field-type">
            <TypeRef
              :parent-instance-id="cardInstanceId()"
              :slot-key="typeSlot(route)"
              :type-name="route.field.type"
            />
          </div>
          <div class="schema-design-update-process-card__field-stack-label">use</div>
          <div class="schema-design-update-process-card__field-use">
            <button
              v-for="step in route.handlerPlanSteps"
              :key="step.id"
              class="schema-design-update-process-card__plan-use"
              :title="`${step.op}: ${step.description}`"
              type="button"
              @click="onPlanStepUseClick(step.id)"
            >
              #{{ String(step.stepNumber) }}
            </button>
            <span
              v-if="route.status === 'gap'"
              class="schema-design-update-process-card__route-gap"
            >
              gap
            </span>
          </div>
          <div class="schema-design-update-process-card__field-stack-label">db</div>
          <div class="schema-design-update-process-card__field-db">
            <button
              v-for="write in route.tableWrites"
              :key="write.id"
              class="schema-design-update-process-card__db-table"
              :title="`${write.op}: ${write.description}`"
              type="button"
              @click="onTableWriteClick(write)"
            >
              {{ write.table }}
            </button>
            <span
              v-for="step in delegatedStorageSteps(route)"
              :key="step.id"
              class="schema-design-update-process-card__db-delegate"
              :title="`${step.op}: ${step.description}`"
            >
              via
              <TypeRef
                :parent-instance-id="cardInstanceId()"
                :slot-key="delegateStepSlot(route, step)"
                :type-name="step.type ?? ''"
              />
            </span>
            <span v-if="routeIsNotStored(route)" class="schema-design-update-process-card__db-none">
              not stored
            </span>
            <button
              v-for="write in route.dbWrites"
              :key="`${write.columnId}:${write.sourceField}`"
              class="schema-design-update-process-card__db-write"
              type="button"
              @click="onDbWriteClick(write)"
            >
              {{ write.table }}.{{ write.column }}
            </button>
          </div>
          <div
            v-if="inlineCardsForRoute(route).length > 0"
            class="schema-design-update-process-card__inline-cards"
          >
            <EntityCard
              v-for="card in inlineCardsForRoute(route)"
              :key="card.instanceId"
              :depth="1"
              :instance="card"
            />
          </div>
        </div>
      </div>
    </section>

    <section v-if="dbWrites.length > 0" class="schema-design-update-process-card__section">
      <h4 class="schema-design-update-process-card__section-title">DB writes</h4>
      <div class="schema-design-update-process-card__db-write-list">
        <button
          v-for="write in dbWrites"
          :key="`${write.columnId}:${write.sourceField}`"
          class="schema-design-update-process-card__db-write-row"
          type="button"
          @click="onDbWriteClick(write)"
        >
          {{ write.sourceField }} -> {{ write.table }}.{{ write.column }}
        </button>
      </div>
    </section>
  </article>
</template>

<style scoped>
@reference '../../style.css';

.schema-design-update-process-card {
  @apply rounded border border-l-4 border-neutral-200 border-l-rose-500 bg-white p-3;
}

.schema-design-update-process-card__header {
  @apply flex items-start justify-between gap-3;
}

.schema-design-update-process-card__heading {
  @apply min-w-0;
}

.schema-design-update-process-card__kind {
  @apply text-[11px] font-semibold uppercase leading-none text-neutral-500;
}

.schema-design-update-process-card__title {
  @apply m-0 mt-1 break-words font-mono text-lg font-semibold leading-tight text-neutral-950;
}

.schema-design-update-process-card__description {
  @apply m-0 mt-1 text-xs leading-snug text-neutral-600;
}

.schema-design-update-process-card__metrics {
  @apply flex shrink-0 flex-wrap justify-end gap-1;
}

.schema-design-update-process-card__metric {
  @apply rounded border border-neutral-200 bg-neutral-50 px-1.5 py-0.5 font-mono text-[10px] leading-none text-neutral-600;
}

.schema-design-update-process-card__section {
  @apply mt-3;
}

.schema-design-update-process-card__section-header {
  @apply mb-1 flex items-center justify-between gap-2;
}

.schema-design-update-process-card__section-title {
  @apply m-0 text-[11px] font-semibold uppercase leading-none text-neutral-500;
}

.schema-design-update-process-card__plan-state {
  @apply rounded border border-emerald-200 bg-emerald-50 px-1 py-0 font-mono text-[10px] font-semibold leading-snug text-emerald-700;
}

.schema-design-update-process-card__plan-summary {
  @apply m-0 mb-1 text-xs leading-snug text-neutral-700;
}

.schema-design-update-process-card__plan-steps {
  @apply m-0 flex list-decimal flex-col border-t border-neutral-200 pl-5;
}

.schema-design-update-process-card__plan-step {
  @apply border-b border-neutral-200 px-1 py-1.5 outline-none;
}

.schema-design-update-process-card__plan-step[data-focused='true'] {
  @apply bg-sky-50;
}

.schema-design-update-process-card__plan-op {
  @apply mr-1 rounded border border-neutral-200 bg-neutral-50 px-1 py-0 font-mono text-[10px] font-semibold leading-snug text-neutral-600;
}

.schema-design-update-process-card__plan-description {
  @apply font-mono text-xs leading-snug text-neutral-950;
}

.schema-design-update-process-card__plan-meta {
  @apply ml-1 font-mono text-[10px] leading-snug text-neutral-500;
}

.schema-design-update-process-card__plan-sources {
  @apply mt-1 block break-words font-mono text-[10px] leading-snug text-neutral-400;
}

.schema-design-update-process-card__field-grid {
  @apply grid min-w-0 grid-cols-[minmax(0,1fr)_minmax(7rem,max-content)_max-content_minmax(0,1.2fr)] border-t border-neutral-200;
}

.schema-design-update-process-card__field-grid-heading {
  @apply border-b border-neutral-200 bg-neutral-50 px-1 py-1 text-[10px] font-semibold uppercase leading-none text-neutral-500;
}

.schema-design-update-process-card__field-grid-row {
  @apply contents;
}

.schema-design-update-process-card__field-grid-row[data-focused='true'] > * {
  @apply bg-sky-50;
}

.schema-design-update-process-card__field-grid-row[data-status='gap'] > * {
  @apply bg-rose-50;
}

.schema-design-update-process-card__field-name {
  @apply min-w-0 break-words border-b border-neutral-200 px-1 py-1.5 font-mono text-sm leading-snug text-neutral-950;
}

.schema-design-update-process-card__field-type {
  @apply min-w-0 break-words border-b border-neutral-200 px-1 py-1.5 font-mono text-xs leading-snug text-neutral-600;
}

.schema-design-update-process-card__field-use {
  @apply flex min-w-0 flex-wrap items-baseline gap-1 border-b border-neutral-200 px-1 py-1.5;
}

.schema-design-update-process-card__field-db {
  @apply flex min-w-0 flex-wrap items-baseline gap-1 border-b border-neutral-200 px-1 py-1.5;
}

.schema-design-update-process-card__field-stack {
  @apply flex flex-col border-t border-neutral-200;
}

.schema-design-update-process-card__field-stack-row {
  @apply grid min-w-0 grid-cols-[max-content_minmax(0,1fr)] items-baseline gap-x-2 border-b border-neutral-200 px-1 py-1.5;
}

.schema-design-update-process-card__field-stack-row[data-focused='true'] {
  @apply bg-sky-50;
}

.schema-design-update-process-card__field-stack-row[data-status='gap'] {
  @apply bg-rose-50;
}

.schema-design-update-process-card__field-stack-label {
  @apply py-0.5 font-mono text-[10px] font-semibold uppercase leading-snug text-neutral-500;
}

.schema-design-update-process-card__field-stack-row .schema-design-update-process-card__field-name,
.schema-design-update-process-card__field-stack-row .schema-design-update-process-card__field-type,
.schema-design-update-process-card__field-stack-row .schema-design-update-process-card__field-use,
.schema-design-update-process-card__field-stack-row .schema-design-update-process-card__field-db {
  @apply border-b-0 py-0.5;
}

.schema-design-update-process-card__plan-use {
  @apply inline-flex max-w-full appearance-none items-center rounded border border-sky-200 bg-sky-50 px-1 py-0 font-mono text-[0.92em] font-semibold leading-snug text-sky-700 outline-none hover:border-sky-300 hover:bg-sky-100 hover:text-sky-900 focus:border-sky-400 focus:bg-sky-100;
}

.schema-design-update-process-card__db-write {
  @apply inline-flex max-w-full appearance-none items-center rounded border border-l-2 border-neutral-200 border-l-rose-500 bg-white px-1 py-0 text-left font-mono text-[0.92em] leading-snug text-rose-700 outline-none hover:border-neutral-300 hover:bg-rose-50 hover:text-rose-900;
}

.schema-design-update-process-card__db-table {
  @apply inline-flex max-w-full appearance-none items-center rounded border border-l-2 border-neutral-200 border-l-rose-500 bg-white px-1 py-0 text-left font-mono text-[0.92em] leading-snug text-rose-700 outline-none hover:border-neutral-300 hover:bg-rose-50 hover:text-rose-900;
}

.schema-design-update-process-card__db-delegate {
  @apply inline-flex max-w-full items-center gap-0.5 rounded border border-neutral-200 bg-neutral-50 px-1 py-0 font-mono text-[0.92em] leading-snug text-neutral-500;
}

.schema-design-update-process-card__db-none {
  @apply inline-flex max-w-full items-center rounded border border-neutral-200 bg-neutral-50 px-1 py-0 font-mono text-[0.92em] leading-snug text-neutral-500;
}

.schema-design-update-process-card__route-gap {
  @apply inline-flex items-center rounded border border-rose-200 bg-rose-50 px-1 py-0 font-mono text-[0.92em] leading-snug text-rose-700;
}

.schema-design-update-process-card__inline-cards {
  @apply col-span-full flex flex-col gap-2 border-b border-neutral-200 px-1 py-2;
}

.schema-design-update-process-card__db-write-list {
  @apply flex flex-col border-t border-neutral-200;
}

.schema-design-update-process-card__db-write-row {
  @apply appearance-none border-0 border-b border-neutral-200 bg-white px-1 py-1 text-left font-mono text-xs leading-snug text-rose-700 outline-none hover:bg-rose-50 hover:text-rose-900 focus:outline-none;
}

@media (max-width: 900px) {
  .schema-design-update-process-card__header {
    @apply flex-col;
  }

  .schema-design-update-process-card__metrics {
    @apply justify-start;
  }

  .schema-design-update-process-card__field-grid {
    @apply grid-cols-[minmax(0,1fr)];
  }

  .schema-design-update-process-card__field-grid-heading {
    @apply hidden;
  }

  .schema-design-update-process-card__field-grid-row {
    @apply grid min-w-0 grid-cols-[max-content_minmax(0,1fr)] border-b border-neutral-200 px-1 py-1.5;
  }

  .schema-design-update-process-card__field-grid-row .schema-design-update-process-card__field-name,
  .schema-design-update-process-card__field-grid-row .schema-design-update-process-card__field-type,
  .schema-design-update-process-card__field-grid-row .schema-design-update-process-card__field-use,
  .schema-design-update-process-card__field-grid-row .schema-design-update-process-card__field-db {
    @apply border-b-0 py-0.5;
  }
}
</style>
