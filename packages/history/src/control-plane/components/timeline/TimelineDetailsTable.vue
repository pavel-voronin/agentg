<script setup lang="ts">
import UiButton from '@agentg/control-plane-sdk/ui';
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
  <div class="history-details-table">
    <section v-for="section in sections" :key="section.type" class="history-details-table__section">
      <div class="history-details-table__title">{{ section.title }}</div>
      <div class="history-details-table__shell">
        <table class="history-details-table__table">
          <thead class="history-details-table__head">
            <tr v-if="section.type === 'target'">
              <th class="history-details-table__heading">Start</th>
              <th class="history-details-table__heading">End</th>
              <th class="history-details-table__heading">Duration</th>
              <th class="history-details-table__heading">Template</th>
              <th class="history-details-table__heading">Target id</th>
              <th class="history-details-table__delete-head"></th>
            </tr>
            <tr v-else-if="section.type === 'job'">
              <th class="history-details-table__heading">Start</th>
              <th class="history-details-table__heading">End</th>
              <th class="history-details-table__heading">Duration</th>
              <th class="history-details-table__heading">Status</th>
              <th class="history-details-table__heading">id</th>
              <th class="history-details-table__heading">cursor</th>
            </tr>
            <tr v-else>
              <th class="history-details-table__heading">Start</th>
              <th class="history-details-table__heading">End</th>
              <th class="history-details-table__heading">Duration</th>
              <th class="history-details-table__heading">Messages</th>
            </tr>
          </thead>
          <tbody class="history-details-table__body">
            <tr
              v-for="detail in section.items"
              :key="detail.key"
              tabindex="0"
              class="history-details-table__row"
              :data-highlighted="isHighlighted(detail.key)"
              :data-type="detail.type"
              @blur="emit('clearHover')"
              @focus="emit('detailFocus', detail, $event)"
              @pointerenter="emit('detailHover', detail)"
              @pointerleave="emit('clearHighlight')"
            >
              <td class="history-details-table__monospace-cell">
                <div>{{ detail.startValue }}</div>
                <div v-if="detail.startNote" class="history-details-table__note">
                  {{ detail.startNote }}
                </div>
              </td>
              <td class="history-details-table__monospace-cell">
                <div>{{ detail.endValue }}</div>
                <div v-if="detail.endNote" class="history-details-table__note">
                  {{ detail.endNote }}
                </div>
              </td>
              <td class="history-details-table__muted-cell">{{ detail.duration }}</td>

              <template v-if="detail.type === 'target'">
                <td class="history-details-table__cell">{{ detail.templateId }}</td>
                <td class="history-details-table__cell">
                  <code class="history-details-table__code">{{ detail.id }}</code>
                </td>
                <td class="history-details-table__action-cell">
                  <UiButton
                    v-if="detail.id"
                    class="history-details-table__delete-button"
                    size="xs"
                    variant="danger"
                    @click="deleteDetailTarget(detail)"
                  >
                    Delete
                  </UiButton>
                </td>
              </template>

              <template v-else-if="detail.type === 'job'">
                <td class="history-details-table__cell">{{ detail.status }}</td>
                <td class="history-details-table__cell">
                  <code class="history-details-table__code">{{ detail.id }}</code>
                </td>
                <td class="history-details-table__cell">
                  <code v-if="detail.cursor">yes</code>
                </td>
              </template>

              <template v-else>
                <td class="history-details-table__muted-cell">{{ detail.count }}</td>
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
.history-details-table {
  @apply mt-3 grid gap-3;
}

.history-details-table__section {
  @apply grid gap-1;
}

.history-details-table__title {
  @apply text-xs font-semibold text-zinc-500;
}

.history-details-table__shell {
  @apply overflow-hidden rounded-lg border border-zinc-200;
}

.history-details-table__table {
  @apply w-full border-collapse text-left text-xs;
}

.history-details-table__head {
  @apply bg-zinc-50 text-zinc-500;
}

.history-details-table__heading {
  @apply px-3 py-2 font-semibold;
}

.history-details-table__delete-head {
  @apply w-20 px-3 py-2;
}

.history-details-table__body {
  @apply divide-y divide-zinc-100 bg-white;
}

.history-details-table__row[data-highlighted='true'] {
  @apply bg-emerald-50;
}

.history-details-table__monospace-cell {
  @apply px-3 py-2 font-mono text-zinc-700;
}

.history-details-table__note {
  @apply mt-0.5 text-[11px] text-zinc-400;
}

.history-details-table__muted-cell {
  @apply px-3 py-2 text-zinc-500;
}

.history-details-table__cell {
  @apply px-3 py-2 text-zinc-600;
}

.history-details-table__code {
  @apply break-all text-zinc-500;
}

.history-details-table__action-cell {
  @apply px-3 py-1 text-right;
}

.history-details-table__delete-button {
  @apply px-2 py-0.5;
}
</style>
