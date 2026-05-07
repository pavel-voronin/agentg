<script setup lang="ts">
import UiButton from '@agentg/control-plane-extension/ui';
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
  <div class="mt-3 grid gap-3">
    <section v-for="section in sections" :key="section.type" class="grid gap-1">
      <div class="text-xs font-semibold text-zinc-500">{{ section.title }}</div>
      <div class="overflow-hidden rounded-lg border border-zinc-200">
        <table class="w-full border-collapse text-left text-xs">
          <thead class="bg-zinc-50 text-zinc-500">
            <tr v-if="section.type === 'target'">
              <th class="px-3 py-2 font-semibold">Start</th>
              <th class="px-3 py-2 font-semibold">End</th>
              <th class="px-3 py-2 font-semibold">Duration</th>
              <th class="px-3 py-2 font-semibold">Template</th>
              <th class="px-3 py-2 font-semibold">Target id</th>
              <th class="w-20 px-3 py-2"></th>
            </tr>
            <tr v-else-if="section.type === 'job'">
              <th class="px-3 py-2 font-semibold">Start</th>
              <th class="px-3 py-2 font-semibold">End</th>
              <th class="px-3 py-2 font-semibold">Duration</th>
              <th class="px-3 py-2 font-semibold">Status</th>
              <th class="px-3 py-2 font-semibold">id</th>
              <th class="px-3 py-2 font-semibold">cursor</th>
            </tr>
            <tr v-else>
              <th class="px-3 py-2 font-semibold">Start</th>
              <th class="px-3 py-2 font-semibold">End</th>
              <th class="px-3 py-2 font-semibold">Duration</th>
              <th class="px-3 py-2 font-semibold">Messages</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-zinc-100 bg-white">
            <tr
              v-for="detail in section.items"
              :key="detail.key"
              tabindex="0"
              :class="[
                'timeline-table-row',
                detail.type === 'coverage' ? 'coverage-table-row' : '',
                isHighlighted(detail.key) ? 'timeline-linked-hover coverage-linked-hover' : ''
              ]"
              @blur="emit('clearHover')"
              @focus="emit('detailFocus', detail, $event)"
              @pointerenter="emit('detailHover', detail)"
              @pointerleave="emit('clearHighlight')"
            >
              <td class="px-3 py-2 font-mono text-zinc-700">
                <div>{{ detail.startValue }}</div>
                <div v-if="detail.startNote" class="mt-0.5 text-[11px] text-zinc-400">
                  {{ detail.startNote }}
                </div>
              </td>
              <td class="px-3 py-2 font-mono text-zinc-700">
                <div>{{ detail.endValue }}</div>
                <div v-if="detail.endNote" class="mt-0.5 text-[11px] text-zinc-400">
                  {{ detail.endNote }}
                </div>
              </td>
              <td class="px-3 py-2 text-zinc-500">{{ detail.duration }}</td>

              <template v-if="detail.type === 'target'">
                <td class="px-3 py-2 text-zinc-600">{{ detail.templateId }}</td>
                <td class="px-3 py-2">
                  <code class="break-all text-zinc-500">{{ detail.id }}</code>
                </td>
                <td class="px-3 py-1 text-right">
                  <UiButton
                    v-if="detail.id"
                    class="px-2 py-0.5"
                    size="xs"
                    variant="danger"
                    @click="deleteDetailTarget(detail)"
                  >
                    Delete
                  </UiButton>
                </td>
              </template>

              <template v-else-if="detail.type === 'job'">
                <td class="px-3 py-2 text-zinc-600">{{ detail.status }}</td>
                <td class="px-3 py-2">
                  <code class="break-all text-zinc-500">{{ detail.id }}</code>
                </td>
                <td class="px-3 py-2">
                  <code v-if="detail.cursor">yes</code>
                </td>
              </template>

              <template v-else>
                <td class="px-3 py-2 text-zinc-500">{{ detail.count }}</td>
              </template>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  </div>
</template>
