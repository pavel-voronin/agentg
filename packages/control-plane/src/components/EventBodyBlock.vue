<script setup lang="ts">
import type { AppEventBodyView } from '../stores/controlPlaneTypes.js';
import { dispatchModelRefSelected } from '@agentg/control-plane-sdk/model-ref-events';

defineProps<{
  body: AppEventBodyView;
  bordered?: boolean;
  mode: 'raw' | 'yaml';
  muted: boolean;
}>();

function lineStyle(indent: number): Record<string, string> {
  return {
    paddingLeft: `${String(indent)}rem`
  };
}

function selectModelRef(model: string, id: string): void {
  dispatchModelRefSelected({ id, model });
}
</script>

<template>
  <pre
    v-if="mode === 'raw'"
    class="event-body-block__raw"
    :data-bordered="bordered ? 'true' : undefined"
    :data-muted="muted ? 'true' : undefined"
    >{{ body.raw }}</pre
  >
  <div
    v-else
    class="event-body-block__yaml"
    :data-bordered="bordered ? 'true' : undefined"
    :data-muted="muted ? 'true' : undefined"
  >
    <div
      v-for="(line, lineIndex) in body.yamlLines"
      :key="lineIndex"
      :style="lineStyle(line.indent)"
    >
      <template v-for="(token, tokenIndex) in line.tokens" :key="tokenIndex">
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

.event-body-block__raw[data-muted='true'],
.event-body-block__yaml[data-muted='true'] {
  @apply border-zinc-300 text-zinc-500;
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
</style>
