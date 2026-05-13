<script setup lang="ts">
import { nextTick, ref, watch } from 'vue';

import type {
  SchemaDesignFieldLayout,
  SchemaDesignSourceFocusRequest,
  SchemaDesignTableFocusRequest,
  SchemaDesignUpdateFocusTarget
} from '../../schemaDesignView.js';
import type {
  StorageReviewEntry,
  StorageSchemaTable,
  StorageSchemaUpdateDesign
} from '../../storageReviewTypes.js';
import type { TdlibCallableEntity } from '../../types.js';
import SchemaDesignScrollIndicator from './SchemaDesignScrollIndicator.vue';
import SchemaDesignUpdateRow from './SchemaDesignUpdateRow.vue';
import { useSchemaDesignScrollIndicator } from './schemaDesignScrollIndicator.js';

const props = defineProps<{
  entries: StorageReviewEntry[];
  expandedUpdateNames: Set<string>;
  fieldLayout: SchemaDesignFieldLayout;
  focusTarget: SchemaDesignUpdateFocusTarget | null;
  scrollTop: number;
  tables: StorageSchemaTable[];
  totalUpdateCount: number;
  updateDesigns: Record<string, StorageSchemaUpdateDesign>;
  updates: TdlibCallableEntity[];
}>();

const emit = defineEmits<{
  fieldLayoutChange: [fieldLayout: SchemaDesignFieldLayout];
  scrollChange: [scrollTop: number];
  sourceFocus: [target: SchemaDesignSourceFocusRequest];
  tableFocus: [target: SchemaDesignTableFocusRequest];
  updateExpandedChange: [updateName: string, expanded: boolean];
}>();

const shellElement = ref<HTMLElement | null>(null);
const { scrollIndicatorScrollable, scrollIndicatorStyle, updateScrollIndicator } =
  useSchemaDesignScrollIndicator(
    shellElement,
    '.schema-design-update-table__table',
    '.schema-design-update-table__head'
  );

watch(
  () => [props.scrollTop, props.updates.length] as const,
  async ([scrollTop]) => {
    await nextTick();
    if (shellElement.value !== null && shellElement.value.scrollTop !== scrollTop) {
      shellElement.value.scrollTop = scrollTop;
    }
    updateScrollIndicator();
  },
  { immediate: true }
);

watch(
  () => props.focusTarget?.id,
  async () => {
    if (props.focusTarget === null) {
      return;
    }

    emit('updateExpandedChange', props.focusTarget.update, true);
    await nextTick();
    await nextTick();
    scrollToFocusTarget(props.focusTarget);
  },
  { flush: 'post', immediate: true }
);

function onScroll(event: Event): void {
  const target = event.currentTarget;
  if (target instanceof HTMLElement) {
    updateScrollIndicator(target);
    emit('scrollChange', Math.round(target.scrollTop));
  }
}

function scrollToFocusTarget(target: SchemaDesignUpdateFocusTarget): void {
  const shell = shellElement.value;
  if (shell === null) {
    return;
  }

  const updateRow =
    [...shell.querySelectorAll<HTMLElement>('[data-schema-update-row]')].find(
      (element) => element.dataset.schemaUpdateRow === target.update
    ) ?? null;
  const expandedRow =
    [...shell.querySelectorAll<HTMLElement>('[data-schema-update]')].find(
      (element) => element.dataset.schemaUpdate === target.update
    ) ?? null;
  const focusedField = expandedRow?.querySelector<HTMLElement>('[data-focused="true"]') ?? null;
  const targetElement = focusedField ?? expandedRow ?? updateRow;
  if (targetElement === null) {
    return;
  }

  const shellRect = shell.getBoundingClientRect();
  const targetRect = targetElement.getBoundingClientRect();
  const targetOffset = focusedField === null ? 28 : shell.clientHeight / 2 - targetRect.height / 2;
  const nextScrollTop = Math.max(
    0,
    Math.round(shell.scrollTop + targetRect.top - shellRect.top - targetOffset)
  );
  shell.scrollTop = nextScrollTop;
  updateScrollIndicator(shell);
  emit('scrollChange', nextScrollTop);
}
</script>

<template>
  <section class="schema-design-update-table">
    <div ref="shellElement" class="schema-design-update-table__shell" @scroll="onScroll">
      <table class="schema-design-update-table__table">
        <colgroup>
          <col class="schema-design-update-table__update-column" />
        </colgroup>
        <thead class="schema-design-update-table__head">
          <tr class="schema-design-update-table__row">
            <th class="schema-design-update-table__update-heading" scope="col">
              <div class="schema-design-update-table__update-heading-content">
                Update
                <span class="schema-design-update-table__update-heading-count">
                  {{ updates.length }} / {{ totalUpdateCount }}
                </span>
              </div>
            </th>
          </tr>
        </thead>
        <tbody class="schema-design-update-table__body">
          <SchemaDesignUpdateRow
            v-for="update in updates"
            :key="update.name"
            :detail-expanded="expandedUpdateNames.has(update.name)"
            :entries="entries"
            :field-layout="fieldLayout"
            :focus-target="focusTarget"
            :tables="tables"
            :update="update"
            :update-design="updateDesigns[update.name]"
            @detail-expanded-change="emit('updateExpandedChange', update.name, $event)"
            @field-layout-change="emit('fieldLayoutChange', $event)"
            @source-focus="emit('sourceFocus', $event)"
            @table-focus="emit('tableFocus', $event)"
          />
        </tbody>
      </table>
    </div>
    <SchemaDesignScrollIndicator
      :indicator-style="scrollIndicatorStyle"
      :scrollable="scrollIndicatorScrollable"
    />
  </section>
</template>

<style scoped>
@reference '../../style.css';

.schema-design-update-table {
  @apply relative h-full min-h-0 overflow-hidden bg-white;
}

.schema-design-update-table__shell {
  @apply h-full min-h-0 overflow-x-auto overflow-y-scroll overscroll-none [-ms-overflow-style:none] [scrollbar-width:none];
}

.schema-design-update-table__shell::-webkit-scrollbar {
  @apply hidden;
}

.schema-design-update-table__table {
  @apply w-full table-fixed border-separate border-spacing-0 text-left;
}

.schema-design-update-table__update-column {
  @apply w-full;
}

.schema-design-update-table__head {
  @apply sticky top-0 z-10 bg-neutral-100;
}

.schema-design-update-table__row {
  @apply align-top;
}

.schema-design-update-table__update-heading {
  @apply whitespace-nowrap border-b border-neutral-300 px-2 py-1.5 text-xs font-semibold uppercase text-neutral-600;
}

.schema-design-update-table__update-heading-content {
  @apply flex h-[22px] items-center gap-2;
}

.schema-design-update-table__update-heading-count {
  @apply font-mono text-[11px] font-medium normal-case text-neutral-400;
}

.schema-design-update-table__body {
  @apply bg-white;
}
</style>
