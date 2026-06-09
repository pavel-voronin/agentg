<script setup lang="ts">
import { UiButton } from '@agentg/framework/dashboard';
import type { TimelineDetail, TimelineDetailSection } from '../../timeline/timelineModel.js';

const props = defineProps<{
  highlightedKeys: string[];
  sections: TimelineDetailSection[];
}>();

const emit = defineEmits<{
  clearHighlight: [];
  clearHover: [];
  deleteTarget: [targetId: string];
  detailFocus: [detail: TimelineDetail, event: Event];
  detailHover: [detail: TimelineDetail];
}>();

function deleteDetailTarget(detail: TimelineDetail): void {
  if (detail.id) {
    emit('deleteTarget', detail.id);
  }
}

function isHighlighted(key: string): boolean {
  return props.highlightedKeys.includes(key);
}
</script>

<template>
  <div class="history-sync-details-table">
    <section
      v-for="section in sections"
      :key="section.type"
      class="history-sync-details-table__section"
    >
      <div class="history-sync-details-table__title">{{ section.title }}</div>
      <div class="history-sync-details-table__shell">
        <table class="history-sync-details-table__table">
          <thead class="history-sync-details-table__head">
            <tr v-if="section.type === 'target'">
              <th class="history-sync-details-table__heading">Start</th>
              <th class="history-sync-details-table__heading">End</th>
              <th class="history-sync-details-table__heading">Duration</th>
              <th class="history-sync-details-table__heading">Template</th>
              <th class="history-sync-details-table__heading">Target id</th>
              <th class="history-sync-details-table__delete-head"></th>
            </tr>
            <tr v-else>
              <th class="history-sync-details-table__heading">Start</th>
              <th class="history-sync-details-table__heading">End</th>
              <th class="history-sync-details-table__heading">Duration</th>
              <th class="history-sync-details-table__heading">Messages</th>
            </tr>
          </thead>
          <tbody class="history-sync-details-table__body">
            <tr
              v-for="detail in section.items"
              :key="detail.key"
              tabindex="0"
              class="history-sync-details-table__row"
              :data-highlighted="isHighlighted(detail.key)"
              :data-type="detail.type"
              @blur="emit('clearHover')"
              @focus="emit('detailFocus', detail, $event)"
              @pointerenter="emit('detailHover', detail)"
              @pointerleave="emit('clearHighlight')"
            >
              <td class="history-sync-details-table__monospace-cell">
                <div>{{ detail.startValue }}</div>
                <div v-if="detail.startNote" class="history-sync-details-table__note">
                  {{ detail.startNote }}
                </div>
              </td>
              <td class="history-sync-details-table__monospace-cell">
                <div>{{ detail.endValue }}</div>
                <div v-if="detail.endNote" class="history-sync-details-table__note">
                  {{ detail.endNote }}
                </div>
              </td>
              <td class="history-sync-details-table__muted-cell">{{ detail.duration }}</td>

              <template v-if="detail.type === 'target'">
                <td class="history-sync-details-table__cell">{{ detail.templateId }}</td>
                <td class="history-sync-details-table__cell">
                  <code class="history-sync-details-table__code">{{ detail.id }}</code>
                </td>
                <td class="history-sync-details-table__action-cell">
                  <UiButton
                    v-if="detail.id"
                    class="history-sync-details-table__delete-button"
                    size="xs"
                    variant="danger"
                    @click="deleteDetailTarget(detail)"
                  >
                    Delete
                  </UiButton>
                </td>
              </template>

              <template v-else>
                <td class="history-sync-details-table__muted-cell">{{ detail.count }}</td>
              </template>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  </div>
</template>

<style scoped>
@reference "tailwindcss";
.history-sync-details-table {
  @apply mt-3 grid gap-3;
}

.history-sync-details-table__section {
  @apply grid gap-1;
}

.history-sync-details-table__title {
  @apply text-xs font-semibold text-zinc-500;
}

.history-sync-details-table__shell {
  @apply overflow-hidden rounded-lg border border-zinc-200;
}

.history-sync-details-table__table {
  @apply w-full border-collapse text-left text-xs;
}

.history-sync-details-table__head {
  @apply bg-zinc-50 text-zinc-500;
}

.history-sync-details-table__heading {
  @apply px-3 py-2 font-semibold;
}

.history-sync-details-table__delete-head {
  @apply w-20 px-3 py-2;
}

.history-sync-details-table__body {
  @apply divide-y divide-zinc-100 bg-white;
}

.history-sync-details-table__row[data-highlighted='true'] {
  @apply bg-emerald-50;
}

.history-sync-details-table__monospace-cell {
  @apply px-3 py-2 font-mono text-zinc-700;
}

.history-sync-details-table__note {
  @apply mt-0.5 text-[11px] text-zinc-400;
}

.history-sync-details-table__muted-cell {
  @apply px-3 py-2 text-zinc-500;
}

.history-sync-details-table__cell {
  @apply px-3 py-2 text-zinc-600;
}

.history-sync-details-table__code {
  @apply break-all text-zinc-500;
}

.history-sync-details-table__action-cell {
  @apply px-3 py-1 text-right;
}

.history-sync-details-table__delete-button {
  @apply px-2 py-0.5;
}
</style>
