<script setup lang="ts">
import { useControlPlaneHost } from '@agentg/framework/cp';
import { computed, shallowRef } from 'vue';

import type {
  AppEventBodyView,
  AppEventYamlLine,
  AppEventYamlRevealLine
} from '../stores/controlPlaneTypes.js';
import { expandEventYamlRevealLine } from '../view-models/eventYamlView.js';

const props = defineProps<{
  body: AppEventBodyView;
  bordered?: boolean;
  mode: 'raw' | 'yaml';
}>();

const expandedRevealIds = shallowRef<ReadonlySet<string>>(new Set());
const host = useControlPlaneHost();
const renderedYamlLines = computed(() =>
  visibleYamlLines(props.body.yamlLines, expandedRevealIds.value)
);

function lineStyle(indent: number): Record<string, string> {
  return {
    paddingLeft: `${String(indent)}rem`
  };
}

function revealYamlLine(line: AppEventYamlRevealLine): void {
  if (expandedRevealIds.value.has(line.id)) {
    return;
  }
  expandedRevealIds.value = new Set([...expandedRevealIds.value, line.id]);
}

function selectModelRef(model: string, id: string): void {
  host.selectModelRef({ id, model });
}

function visibleYamlLines(
  lines: AppEventYamlLine[],
  expandedIds: ReadonlySet<string>
): AppEventYamlLine[] {
  return lines.flatMap((line) => {
    if (line.kind === 'content') {
      return [line];
    }
    if (!expandedIds.has(line.id)) {
      return [line];
    }
    return visibleYamlLines(expandEventYamlRevealLine(line), expandedIds);
  });
}
</script>

<template>
  <pre
    v-if="mode === 'raw'"
    class="event-body-block__raw"
    :data-bordered="bordered ? 'true' : undefined"
    >{{ body.raw }}</pre
  >
  <div v-else class="event-body-block__yaml" :data-bordered="bordered ? 'true' : undefined">
    <div
      v-for="(line, lineIndex) in renderedYamlLines"
      :key="lineIndex"
      :style="lineStyle(line.indent)"
    >
      <button
        v-if="line.kind === 'reveal'"
        type="button"
        class="event-body-block__reveal"
        :aria-label="`Show ${line.hiddenCount} more YAML list items`"
        @click="revealYamlLine(line)"
      >
        {{ line.hiddenCount }} more
      </button>
      <template v-else v-for="(token, tokenIndex) in line.tokens" :key="tokenIndex">
        <span v-if="token.kind === 'text'">{{ token.text }}</span>
        <button
          v-else
          type="button"
          class="event-body-block__model-ref"
          :style="{ borderColor: token.color }"
          :title="`${token.model} ${token.id}`"
          @click="selectModelRef(token.model, token.id)"
        >
          <span class="event-body-block__model-ref-model" :style="{ backgroundColor: token.color }">
            {{ token.model }}
          </span>
          <span class="event-body-block__model-ref-id" :style="{ color: token.color }">
            {{ token.id }}
          </span>
        </button>
      </template>
    </div>
  </div>
</template>

<style scoped>
@reference "tailwindcss";
.event-body-block__raw,
.event-body-block__yaml {
  @apply m-0 whitespace-pre-wrap break-words border-zinc-200 text-zinc-700;
}

.event-body-block__yaml {
  @apply font-mono;
}

.event-body-block__raw[data-bordered='true'],
.event-body-block__yaml[data-bordered='true'] {
  @apply border-t px-2 py-1;
}

.event-body-block__model-ref {
  @apply inline-flex max-w-full overflow-hidden rounded border bg-transparent p-0 align-baseline font-mono leading-tight focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1;
}

.event-body-block__model-ref-model {
  @apply max-w-[9rem] truncate px-1 text-white;
}

.event-body-block__model-ref-id {
  @apply max-w-[12rem] truncate bg-white px-1;
}

.event-body-block__reveal {
  @apply inline-flex items-center rounded border border-zinc-200 bg-white px-1.5 py-0.5 font-mono text-[10px] font-semibold leading-tight text-zinc-500 hover:bg-zinc-50 hover:text-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1;
}
</style>
